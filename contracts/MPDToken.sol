// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MPDToken
 * @author MPD DEX Team
 * @notice MPD is the governance and utility token for the MPD DEX protocol.
 * @dev ERC20 token with minting controlled by owner. 
 *      Ownership will be transferred to governance once the system is deployed.
 */
contract MPDToken is ERC20, Ownable {
    
    // ============ Events ============

    /**
     * @notice Emitted when new tokens are minted
     * @param to The address receiving the minted tokens
     * @param amount The amount of tokens minted
     */
    event TokensMinted(address indexed to, uint256 amount);

    // ============ Constructor ============

    /**
     * @notice Initializes the MPD Token contract
     * @param initialOwner The address that will own this contract and control minting
     */
    constructor(address initialOwner) 
        ERC20("MPD Token", "MPD") 
        Ownable(initialOwner) 
    {}

    // ============ External Functions ============

    /**
     * @notice Mints new MPD tokens to a specified address
     * @dev Only callable by the contract owner
     * @param to The address to receive the minted tokens
     * @param amount The amount of tokens to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "MPDToken: mint to zero address");
        require(amount > 0, "MPDToken: mint amount must be greater than zero");
        
        _mint(to, amount);
        
        emit TokensMinted(to, amount);
    }
}

