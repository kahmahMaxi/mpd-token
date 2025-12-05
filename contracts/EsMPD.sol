// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EsMPD (Escrowed MPD)
 * @author MPD DEX Team
 * @notice Non-transferable escrowed token awarded to stakers of the MPD DEX protocol.
 * 
 * @dev esMPD serves as a reward mechanism with the following properties:
 *      - Awarded to users who stake MPD or provide liquidity
 *      - Cannot be freely transferred between addresses
 *      - Can be staked to earn the same rewards as regular MPD
 *      - Will be vestable into MPD via a separate vesting contract
 * 
 *      This design prevents immediate sell pressure while still rewarding
 *      long-term protocol participants.
 */
contract EsMPD is ERC20, Ownable {

    // ============ State Variables ============

    /**
     * @notice Tracks addresses authorized to mint and burn esMPD
     * @dev Minters will typically be staking/reward contracts
     */
    mapping(address => bool) public isMinter;

    // ============ Events ============

    /**
     * @notice Emitted when a minter's authorization status changes
     * @param minter The address whose minter status changed
     * @param isActive Whether the address is now authorized to mint/burn
     */
    event MinterSet(address indexed minter, bool isActive);

    /**
     * @notice Emitted when new esMPD tokens are minted
     * @param to The address receiving the minted tokens
     * @param amount The amount of tokens minted
     */
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @notice Emitted when esMPD tokens are burned
     * @param from The address whose tokens were burned
     * @param amount The amount of tokens burned
     */
    event TokensBurned(address indexed from, uint256 amount);

    // ============ Errors ============

    /// @notice Thrown when a non-minter attempts to mint or burn
    error NotAuthorizedMinter();

    /// @notice Thrown when attempting to transfer esMPD (transfers are disabled)
    error TransfersDisabled();

    /// @notice Thrown when minting/burning to/from zero address
    error ZeroAddress();

    /// @notice Thrown when amount is zero
    error ZeroAmount();

    // ============ Modifiers ============

    /**
     * @notice Restricts function access to authorized minters only
     */
    modifier onlyMinter() {
        if (!isMinter[msg.sender]) revert NotAuthorizedMinter();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initializes the Escrowed MPD token contract
     * @param initialOwner The address that will own this contract
     */
    constructor(address initialOwner) 
        ERC20("Escrowed MPD", "esMPD") 
        Ownable(initialOwner) 
    {}

    // ============ Owner Functions ============

    /**
     * @notice Sets or revokes minter authorization for an address
     * @dev Only callable by contract owner
     * @param minter The address to update minter status for
     * @param isActive True to authorize, false to revoke
     */
    function setMinter(address minter, bool isActive) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        
        isMinter[minter] = isActive;
        
        emit MinterSet(minter, isActive);
    }

    // ============ Minter Functions ============

    /**
     * @notice Mints new esMPD tokens to a specified address
     * @dev Only callable by authorized minters (e.g., staking contracts)
     * @param to The address to receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyMinter {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        _mint(to, amount);
        
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Burns esMPD tokens from a specified address
     * @dev Only callable by authorized minters (e.g., vesting contracts)
     * @param from The address whose tokens will be burned
     * @param amount The amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyMinter {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        _burn(from, amount);
        
        emit TokensBurned(from, amount);
    }

    // ============ Internal Overrides ============

    /**
     * @notice Blocks all token transfers except minting and burning
     * @dev Overrides the ERC20 _update function to enforce non-transferability
     * @param from Source address (zero address for minting)
     * @param to Destination address (zero address for burning)
     * @param value Amount of tokens
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // Allow minting (from == address(0))
        // Allow burning (to == address(0))
        // Block all other transfers
        if (from != address(0) && to != address(0)) {
            revert TransfersDisabled();
        }
        
        super._update(from, to, value);
    }
}

