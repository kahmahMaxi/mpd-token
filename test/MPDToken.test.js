// SPDX-License-Identifier: MIT
/**
 * @title MPDToken Test Suite
 * @notice Comprehensive tests for the MPDToken governance token contract
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MPDToken", function () {
  
  // ============ Test Fixture ============

  /**
   * @notice Deploys MPDToken and returns test accounts
   */
  async function deployMPDTokenFixture() {
    const [owner, user, recipient] = await ethers.getSigners();

    const MPDToken = await ethers.getContractFactory("MPDToken");
    const mpdToken = await MPDToken.deploy(owner.address);

    return { mpdToken, owner, user, recipient };
  }

  // ============ 1. Deployment Tests ============

  describe("Deployment", function () {
    it("Should set token name to 'MPD Token'", async function () {
      const { mpdToken } = await loadFixture(deployMPDTokenFixture);

      expect(await mpdToken.name()).to.equal("MPD Token");
    });

    it("Should set token symbol to 'MPD'", async function () {
      const { mpdToken } = await loadFixture(deployMPDTokenFixture);

      expect(await mpdToken.symbol()).to.equal("MPD");
    });

    it("Should set decimals to 18", async function () {
      const { mpdToken } = await loadFixture(deployMPDTokenFixture);

      expect(await mpdToken.decimals()).to.equal(18);
    });

    it("Should set deployer as owner", async function () {
      const { mpdToken, owner } = await loadFixture(deployMPDTokenFixture);

      expect(await mpdToken.owner()).to.equal(owner.address);
    });

    it("Should start with zero total supply", async function () {
      const { mpdToken } = await loadFixture(deployMPDTokenFixture);

      expect(await mpdToken.totalSupply()).to.equal(0);
    });
  });

  // ============ 2. Minting Tests ============

  describe("Minting", function () {
    it("Should allow owner to mint tokens to any address", async function () {
      const { mpdToken, owner, user } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await mpdToken.connect(owner).mint(user.address, mintAmount);

      expect(await mpdToken.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Should increase total supply when minting", async function () {
      const { mpdToken, owner, user } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("5000");

      const supplyBefore = await mpdToken.totalSupply();
      await mpdToken.connect(owner).mint(user.address, mintAmount);
      const supplyAfter = await mpdToken.totalSupply();

      expect(supplyAfter).to.equal(supplyBefore + mintAmount);
    });

    it("Should credit minted tokens to recipient", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("2500");

      const balanceBefore = await mpdToken.balanceOf(recipient.address);
      await mpdToken.connect(owner).mint(recipient.address, mintAmount);
      const balanceAfter = await mpdToken.balanceOf(recipient.address);

      expect(balanceAfter).to.equal(balanceBefore + mintAmount);
    });

    it("Should allow multiple mints to same address", async function () {
      const { mpdToken, owner, user } = await loadFixture(deployMPDTokenFixture);
      const firstMint = ethers.parseEther("1000");
      const secondMint = ethers.parseEther("500");

      await mpdToken.connect(owner).mint(user.address, firstMint);
      await mpdToken.connect(owner).mint(user.address, secondMint);

      expect(await mpdToken.balanceOf(user.address)).to.equal(firstMint + secondMint);
    });

    it("Should reject minting to zero address", async function () {
      const { mpdToken, owner } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(
        mpdToken.connect(owner).mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("MPDToken: mint to zero address");
    });

    it("Should reject minting zero amount", async function () {
      const { mpdToken, owner, user } = await loadFixture(deployMPDTokenFixture);

      await expect(
        mpdToken.connect(owner).mint(user.address, 0)
      ).to.be.revertedWith("MPDToken: mint amount must be greater than zero");
    });
  });

  // ============ 3. Mint Permission Tests ============

  describe("Mint Permission", function () {
    it("Should reject minting from non-owner", async function () {
      const { mpdToken, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(
        mpdToken.connect(user).mint(recipient.address, mintAmount)
      ).to.be.revertedWithCustomError(mpdToken, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });

    it("Should reject minting from any non-owner address", async function () {
      const { mpdToken, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(
        mpdToken.connect(recipient).mint(recipient.address, mintAmount)
      ).to.be.revertedWithCustomError(mpdToken, "OwnableUnauthorizedAccount")
        .withArgs(recipient.address);
    });

    it("Should allow only owner to mint after ownership transfer", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      // Transfer ownership to user
      await mpdToken.connect(owner).transferOwnership(user.address);

      // Original owner should no longer be able to mint
      await expect(
        mpdToken.connect(owner).mint(recipient.address, mintAmount)
      ).to.be.revertedWithCustomError(mpdToken, "OwnableUnauthorizedAccount");

      // New owner should be able to mint
      await mpdToken.connect(user).mint(recipient.address, mintAmount);
      expect(await mpdToken.balanceOf(recipient.address)).to.equal(mintAmount);
    });
  });

  // ============ 4. Transfer Tests ============

  describe("Transfers", function () {
    it("Should allow user to transfer tokens to another address", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("300");

      // Mint tokens to user first
      await mpdToken.connect(owner).mint(user.address, mintAmount);

      // Transfer from user to recipient
      await mpdToken.connect(user).transfer(recipient.address, transferAmount);

      expect(await mpdToken.balanceOf(recipient.address)).to.equal(transferAmount);
    });

    it("Should update balances correctly after transfer", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("400");

      await mpdToken.connect(owner).mint(user.address, mintAmount);

      const userBalanceBefore = await mpdToken.balanceOf(user.address);
      const recipientBalanceBefore = await mpdToken.balanceOf(recipient.address);

      await mpdToken.connect(user).transfer(recipient.address, transferAmount);

      const userBalanceAfter = await mpdToken.balanceOf(user.address);
      const recipientBalanceAfter = await mpdToken.balanceOf(recipient.address);

      expect(userBalanceAfter).to.equal(userBalanceBefore - transferAmount);
      expect(recipientBalanceAfter).to.equal(recipientBalanceBefore + transferAmount);
    });

    it("Should not change total supply after transfer", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("500");

      await mpdToken.connect(owner).mint(user.address, mintAmount);

      const supplyBefore = await mpdToken.totalSupply();
      await mpdToken.connect(user).transfer(recipient.address, transferAmount);
      const supplyAfter = await mpdToken.totalSupply();

      expect(supplyAfter).to.equal(supplyBefore);
    });

    it("Should revert when transferring more than balance", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("200");

      await mpdToken.connect(owner).mint(user.address, mintAmount);

      await expect(
        mpdToken.connect(user).transfer(recipient.address, transferAmount)
      ).to.be.revertedWithCustomError(mpdToken, "ERC20InsufficientBalance");
    });

    it("Should revert when transferring with zero balance", async function () {
      const { mpdToken, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const transferAmount = ethers.parseEther("100");

      await expect(
        mpdToken.connect(user).transfer(recipient.address, transferAmount)
      ).to.be.revertedWithCustomError(mpdToken, "ERC20InsufficientBalance");
    });

    it("Should allow transfer of entire balance", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await mpdToken.connect(owner).mint(user.address, mintAmount);
      await mpdToken.connect(user).transfer(recipient.address, mintAmount);

      expect(await mpdToken.balanceOf(user.address)).to.equal(0);
      expect(await mpdToken.balanceOf(recipient.address)).to.equal(mintAmount);
    });

    it("Should allow transfer of zero tokens", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await mpdToken.connect(owner).mint(user.address, mintAmount);

      // Transfer zero should succeed
      await expect(
        mpdToken.connect(user).transfer(recipient.address, 0)
      ).to.not.be.reverted;
    });
  });

  // ============ 5. Event Tests ============

  describe("Events", function () {
    it("Should emit Transfer event when minting", async function () {
      const { mpdToken, owner, user } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(mpdToken.connect(owner).mint(user.address, mintAmount))
        .to.emit(mpdToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, mintAmount);
    });

    it("Should emit TokensMinted event when minting", async function () {
      const { mpdToken, owner, user } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(mpdToken.connect(owner).mint(user.address, mintAmount))
        .to.emit(mpdToken, "TokensMinted")
        .withArgs(user.address, mintAmount);
    });

    it("Should emit Transfer event when transferring", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("500");

      await mpdToken.connect(owner).mint(user.address, mintAmount);

      await expect(mpdToken.connect(user).transfer(recipient.address, transferAmount))
        .to.emit(mpdToken, "Transfer")
        .withArgs(user.address, recipient.address, transferAmount);
    });

    it("Should emit Approval event when approving", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const approvalAmount = ethers.parseEther("500");

      await expect(mpdToken.connect(user).approve(recipient.address, approvalAmount))
        .to.emit(mpdToken, "Approval")
        .withArgs(user.address, recipient.address, approvalAmount);
    });

    it("Should emit Transfer event when using transferFrom", async function () {
      const { mpdToken, owner, user, recipient } = await loadFixture(deployMPDTokenFixture);
      const mintAmount = ethers.parseEther("1000");
      const approvalAmount = ethers.parseEther("500");

      await mpdToken.connect(owner).mint(user.address, mintAmount);
      await mpdToken.connect(user).approve(recipient.address, approvalAmount);

      await expect(
        mpdToken.connect(recipient).transferFrom(user.address, recipient.address, approvalAmount)
      )
        .to.emit(mpdToken, "Transfer")
        .withArgs(user.address, recipient.address, approvalAmount);
    });
  });
});

