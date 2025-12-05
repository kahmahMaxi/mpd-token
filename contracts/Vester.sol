// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ============ Interfaces ============

/**
 * @notice Interface for mintable MPD token
 */
interface IMPDToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @notice Interface for mintable/burnable esMPD token
 */
interface IEsMPD {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/**
 * @title Vester
 * @author MPD DEX Team
 * @notice Vesting contract that converts esMPD to MPD over a fixed duration.
 * 
 * @dev Users deposit esMPD and linearly vest it into MPD over the vesting duration.
 *      - esMPD is held by this contract during vesting
 *      - MPD is minted to users as it vests
 *      - Users can withdraw unvested esMPD at any time (forfeiting pending rewards)
 * 
 *      This contract requires:
 *      - Minter role on MPDToken to mint vested MPD
 *      - Minter role on EsMPD to burn vested esMPD
 */
contract Vester is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice The MPD governance token (reward token)
    IERC20 public immutable mpd;

    /// @notice The escrowed MPD token (deposit token)
    IERC20 public immutable esMpd;

    /// @notice Duration over which esMPD vests into MPD (default: 365 days)
    uint256 public vestingDuration;

    /// @notice Total esMPD deposited by each user
    mapping(address => uint256) public depositedAmount;

    /// @notice Total MPD already claimed by each user
    mapping(address => uint256) public claimedAmount;

    /// @notice Timestamp of user's last claim (or deposit if never claimed)
    mapping(address => uint256) public lastClaimTime;

    /// @notice Timestamp when user first deposited (start of vesting)
    mapping(address => uint256) public vestingStartTime;

    // ============ Events ============

    /**
     * @notice Emitted when a user deposits esMPD for vesting
     * @param user The depositor's address
     * @param amount The amount of esMPD deposited
     */
    event Deposited(address indexed user, uint256 amount);

    /**
     * @notice Emitted when a user claims vested MPD
     * @param user The claimer's address
     * @param amount The amount of MPD claimed
     */
    event Claimed(address indexed user, uint256 amount);

    /**
     * @notice Emitted when a user withdraws unvested esMPD
     * @param user The withdrawer's address
     * @param amount The amount of esMPD returned
     * @param forfeitedMPD The amount of vested MPD forfeited
     */
    event Withdrawn(address indexed user, uint256 amount, uint256 forfeitedMPD);

    /**
     * @notice Emitted when the vesting duration is updated
     * @param oldDuration The previous vesting duration
     * @param newDuration The new vesting duration
     */
    event VestingDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // ============ Errors ============

    /// @notice Thrown when deposit amount is zero
    error ZeroAmount();

    /// @notice Thrown when user has no active vesting position
    error NoVestingPosition();

    /// @notice Thrown when there is nothing to claim
    error NothingToClaim();

    /// @notice Thrown when vesting duration is invalid
    error InvalidVestingDuration();

    // ============ Constructor ============

    /**
     * @notice Initializes the Vester contract
     * @param _mpd Address of the MPD token contract
     * @param _esMpd Address of the esMPD token contract
     * @param _vestingDuration Initial vesting duration in seconds
     * @param _owner Address of the contract owner
     */
    constructor(
        address _mpd,
        address _esMpd,
        uint256 _vestingDuration,
        address _owner
    ) Ownable(_owner) {
        if (_vestingDuration == 0) revert InvalidVestingDuration();
        
        mpd = IERC20(_mpd);
        esMpd = IERC20(_esMpd);
        vestingDuration = _vestingDuration;
    }

    // ============ External Functions ============

    /**
     * @notice Deposit esMPD to begin vesting into MPD
     * @dev esMPD is burned from user (since esMPD is non-transferable) and tracked for vesting
     * @param amount The amount of esMPD to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // If user has existing position, claim pending rewards first
        if (depositedAmount[msg.sender] > 0) {
            _claim(msg.sender);
        }

        // Burn esMPD from user (esMPD is non-transferable, so we burn instead of transfer)
        IEsMPD(address(esMpd)).burn(msg.sender, amount);

        // Update user's vesting position
        if (depositedAmount[msg.sender] == 0) {
            // First deposit: set vesting start time
            vestingStartTime[msg.sender] = block.timestamp;
            lastClaimTime[msg.sender] = block.timestamp;
        }
        
        depositedAmount[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Claim vested MPD tokens
     * @dev Calculates vested amount based on time elapsed and mints MPD to user
     */
    function claim() external nonReentrant {
        if (depositedAmount[msg.sender] == 0) revert NoVestingPosition();
        
        _claim(msg.sender);
    }

    /**
     * @notice Withdraw unvested esMPD and exit vesting
     * @dev Mints back unvested esMPD to user (since esMPD was burned on deposit) and forfeits unclaimed vested amount
     */
    function withdraw() external nonReentrant {
        if (depositedAmount[msg.sender] == 0) revert NoVestingPosition();

        uint256 deposited = depositedAmount[msg.sender];
        uint256 claimed = claimedAmount[msg.sender];
        
        // Calculate total vested amount (what they could have claimed by now)
        uint256 totalVested = _calculateVestedAmount(msg.sender);
        
        // Calculate unvested amount (what they get back)
        uint256 unvested = deposited > totalVested ? deposited - totalVested : 0;
        
        // Calculate forfeited amount (vested but not yet claimed)
        uint256 forfeited = totalVested > claimed ? totalVested - claimed : 0;

        // Reset user's vesting state
        depositedAmount[msg.sender] = 0;
        claimedAmount[msg.sender] = 0;
        lastClaimTime[msg.sender] = 0;
        vestingStartTime[msg.sender] = 0;

        // Mint back unvested esMPD to user (esMPD was burned on deposit, so we mint it back)
        if (unvested > 0) {
            IEsMPD(address(esMpd)).mint(msg.sender, unvested);
        }

        emit Withdrawn(msg.sender, unvested, forfeited);
    }

    // ============ View Functions ============

    /**
     * @notice Calculate the amount of MPD claimable by a user right now
     * @param user The address to check
     * @return The amount of MPD that can be claimed
     */
    function claimable(address user) external view returns (uint256) {
        if (depositedAmount[user] == 0) return 0;
        
        uint256 totalVested = _calculateVestedAmount(user);
        uint256 claimed = claimedAmount[user];
        
        return totalVested > claimed ? totalVested - claimed : 0;
    }

    /**
     * @notice Get the total vested amount for a user (claimed + claimable)
     * @param user The address to check
     * @return The total amount that has vested
     */
    function totalVested(address user) external view returns (uint256) {
        return _calculateVestedAmount(user);
    }

    /**
     * @notice Get the unvested amount for a user
     * @param user The address to check
     * @return The amount of esMPD that hasn't vested yet
     */
    function unvestedAmount(address user) external view returns (uint256) {
        uint256 deposited = depositedAmount[user];
        uint256 vested = _calculateVestedAmount(user);
        
        return deposited > vested ? deposited - vested : 0;
    }

    /**
     * @notice Get the time remaining until fully vested
     * @param user The address to check
     * @return The seconds until fully vested (0 if already fully vested)
     */
    function timeUntilFullyVested(address user) external view returns (uint256) {
        if (depositedAmount[user] == 0) return 0;
        
        uint256 elapsed = block.timestamp - vestingStartTime[user];
        
        if (elapsed >= vestingDuration) return 0;
        
        return vestingDuration - elapsed;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the vesting duration for new deposits
     * @dev Only affects future vesting calculations, not existing positions
     * @param _vestingDuration New vesting duration in seconds
     */
    function setVestingDuration(uint256 _vestingDuration) external onlyOwner {
        if (_vestingDuration == 0) revert InvalidVestingDuration();
        
        uint256 oldDuration = vestingDuration;
        vestingDuration = _vestingDuration;
        
        emit VestingDurationUpdated(oldDuration, _vestingDuration);
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal function to process a claim
     * @dev esMPD was already burned on deposit, so we just mint the vested MPD
     * @param user The address claiming MPD
     */
    function _claim(address user) internal {
        uint256 totalVested = _calculateVestedAmount(user);
        uint256 claimed = claimedAmount[user];
        
        uint256 claimableAmount = totalVested > claimed ? totalVested - claimed : 0;
        
        if (claimableAmount == 0) revert NothingToClaim();

        // Update claimed amount and last claim time
        claimedAmount[user] = totalVested;
        lastClaimTime[user] = block.timestamp;

        // Mint MPD to user (esMPD was already burned on deposit)
        IMPDToken(address(mpd)).mint(user, claimableAmount);

        emit Claimed(user, claimableAmount);
    }

    /**
     * @notice Calculate total vested amount for a user based on time elapsed
     * @dev Uses linear vesting: vestedAmount = depositedAmount * timeElapsed / vestingDuration
     * @param user The address to calculate for
     * @return The total amount that has vested (capped at deposited amount)
     */
    function _calculateVestedAmount(address user) internal view returns (uint256) {
        uint256 deposited = depositedAmount[user];
        
        if (deposited == 0) return 0;
        
        uint256 elapsed = block.timestamp - vestingStartTime[user];
        
        // If fully vested, return total deposited amount
        if (elapsed >= vestingDuration) {
            return deposited;
        }
        
        // Linear vesting calculation
        return (deposited * elapsed) / vestingDuration;
    }
}

