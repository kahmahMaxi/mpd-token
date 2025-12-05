// SPDX-License-Identifier: MIT
/**
 * @title EsMPD Test Suite
 * @notice Comprehensive tests for the EsMPD (Escrowed MPD) token contract
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EsMPD", function () {
  
  // ============ Test Fixture ============

  /**
   * @notice Deploys EsMPD and returns test accounts
   */
  async function deployEsMPDFixture() {
    const [owner, minter, user, otherUser] = await ethers.getSigners();

    const EsMPD = await ethers.getContractFactory("EsMPD");
    const esMPD = await EsMPD.deploy(owner.address);

    return { esMPD, owner, minter, user, otherUser };
  }

  /**
   * @notice Deploys EsMPD with minter already set up
   */
  async function deployWithMinterFixture() {
    const { esMPD, owner, minter, user, otherUser } = await loadFixture(deployEsMPDFixture);

    // Set up minter
    await esMPD.connect(owner).setMinter(minter.address, true);

    return { esMPD, owner, minter, user, otherUser };
  }

  // ============ 1. Deployment Tests ============

  describe("Deployment", function () {
    it("Should set token name to 'Escrowed MPD'", async function () {
      const { esMPD } = await loadFixture(deployEsMPDFixture);

      expect(await esMPD.name()).to.equal("Escrowed MPD");
    });

    it("Should set token symbol to 'esMPD'", async function () {
      const { esMPD } = await loadFixture(deployEsMPDFixture);

      expect(await esMPD.symbol()).to.equal("esMPD");
    });

    it("Should set decimals to 18", async function () {
      const { esMPD } = await loadFixture(deployEsMPDFixture);

      expect(await esMPD.decimals()).to.equal(18);
    });

    it("Should set deployer as owner", async function () {
      const { esMPD, owner } = await loadFixture(deployEsMPDFixture);

      expect(await esMPD.owner()).to.equal(owner.address);
    });

    it("Should have no minters active initially", async function () {
      const { esMPD, minter, user, otherUser } = await loadFixture(deployEsMPDFixture);

      expect(await esMPD.isMinter(minter.address)).to.be.false;
      expect(await esMPD.isMinter(user.address)).to.be.false;
      expect(await esMPD.isMinter(otherUser.address)).to.be.false;
    });

    it("Should start with zero total supply", async function () {
      const { esMPD } = await loadFixture(deployEsMPDFixture);

      expect(await esMPD.totalSupply()).to.equal(0);
    });
  });

  // ============ 2. setMinter Tests ============

  describe("setMinter", function () {
    it("Should allow owner to activate a minter", async function () {
      const { esMPD, owner, minter } = await loadFixture(deployEsMPDFixture);

      await esMPD.connect(owner).setMinter(minter.address, true);

      expect(await esMPD.isMinter(minter.address)).to.be.true;
    });

    it("Should allow owner to deactivate a minter", async function () {
      const { esMPD, owner, minter } = await loadFixture(deployEsMPDFixture);

      // Activate first
      await esMPD.connect(owner).setMinter(minter.address, true);
      expect(await esMPD.isMinter(minter.address)).to.be.true;

      // Deactivate
      await esMPD.connect(owner).setMinter(minter.address, false);
      expect(await esMPD.isMinter(minter.address)).to.be.false;
    });

    it("Should emit MinterSet event when setting minter", async function () {
      const { esMPD, owner, minter } = await loadFixture(deployEsMPDFixture);

      await expect(esMPD.connect(owner).setMinter(minter.address, true))
        .to.emit(esMPD, "MinterSet")
        .withArgs(minter.address, true);
    });

    it("Should emit MinterSet event when unsetting minter", async function () {
      const { esMPD, owner, minter } = await loadFixture(deployEsMPDFixture);

      await esMPD.connect(owner).setMinter(minter.address, true);

      await expect(esMPD.connect(owner).setMinter(minter.address, false))
        .to.emit(esMPD, "MinterSet")
        .withArgs(minter.address, false);
    });

    it("Should revert when non-owner calls setMinter", async function () {
      const { esMPD, minter, user } = await loadFixture(deployEsMPDFixture);

      await expect(
        esMPD.connect(user).setMinter(minter.address, true)
      ).to.be.revertedWithCustomError(esMPD, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });

    it("Should revert when setting zero address as minter", async function () {
      const { esMPD, owner } = await loadFixture(deployEsMPDFixture);

      await expect(
        esMPD.connect(owner).setMinter(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(esMPD, "ZeroAddress");
    });

    it("Should allow multiple minters to be active", async function () {
      const { esMPD, owner, minter, user } = await loadFixture(deployEsMPDFixture);

      await esMPD.connect(owner).setMinter(minter.address, true);
      await esMPD.connect(owner).setMinter(user.address, true);

      expect(await esMPD.isMinter(minter.address)).to.be.true;
      expect(await esMPD.isMinter(user.address)).to.be.true;
    });
  });

  // ============ 3. Minting Tests ============

  describe("Minting", function () {
    it("Should allow minter to mint tokens to a user", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      expect(await esMPD.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Should increase total supply when minting", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("5000");

      const supplyBefore = await esMPD.totalSupply();
      await esMPD.connect(minter).mint(user.address, mintAmount);
      const supplyAfter = await esMPD.totalSupply();

      expect(supplyAfter).to.equal(supplyBefore + mintAmount);
    });

    it("Should increase user balance when minting", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("2500");

      const balanceBefore = await esMPD.balanceOf(user.address);
      await esMPD.connect(minter).mint(user.address, mintAmount);
      const balanceAfter = await esMPD.balanceOf(user.address);

      expect(balanceAfter).to.equal(balanceBefore + mintAmount);
    });

    it("Should revert when non-minter tries to mint", async function () {
      const { esMPD, user, otherUser } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(
        esMPD.connect(user).mint(otherUser.address, mintAmount)
      ).to.be.revertedWithCustomError(esMPD, "NotAuthorizedMinter");
    });

    it("Should revert when deactivated minter tries to mint", async function () {
      const { esMPD, owner, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      // Deactivate minter
      await esMPD.connect(owner).setMinter(minter.address, false);

      await expect(
        esMPD.connect(minter).mint(user.address, mintAmount)
      ).to.be.revertedWithCustomError(esMPD, "NotAuthorizedMinter");
    });

    it("Should revert when minting to zero address", async function () {
      const { esMPD, minter } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(
        esMPD.connect(minter).mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWithCustomError(esMPD, "ZeroAddress");
    });

    it("Should revert when minting zero amount", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);

      await expect(
        esMPD.connect(minter).mint(user.address, 0)
      ).to.be.revertedWithCustomError(esMPD, "ZeroAmount");
    });
  });

  // ============ 4. Burning Tests ============

  describe("Burning", function () {
    it("Should allow minter to burn user's esMPD", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");
      const burnAmount = ethers.parseEther("400");

      await esMPD.connect(minter).mint(user.address, mintAmount);
      await esMPD.connect(minter).burn(user.address, burnAmount);

      expect(await esMPD.balanceOf(user.address)).to.equal(mintAmount - burnAmount);
    });

    it("Should decrease total supply when burning", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");
      const burnAmount = ethers.parseEther("300");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      const supplyBefore = await esMPD.totalSupply();
      await esMPD.connect(minter).burn(user.address, burnAmount);
      const supplyAfter = await esMPD.totalSupply();

      expect(supplyAfter).to.equal(supplyBefore - burnAmount);
    });

    it("Should update balance correctly when burning", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");
      const burnAmount = ethers.parseEther("600");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      const balanceBefore = await esMPD.balanceOf(user.address);
      await esMPD.connect(minter).burn(user.address, burnAmount);
      const balanceAfter = await esMPD.balanceOf(user.address);

      expect(balanceAfter).to.equal(balanceBefore - burnAmount);
    });

    it("Should allow burning entire balance", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      await esMPD.connect(minter).mint(user.address, mintAmount);
      await esMPD.connect(minter).burn(user.address, mintAmount);

      expect(await esMPD.balanceOf(user.address)).to.equal(0);
    });

    it("Should revert when non-minter tries to burn", async function () {
      const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");
      const burnAmount = ethers.parseEther("500");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      await expect(
        esMPD.connect(otherUser).burn(user.address, burnAmount)
      ).to.be.revertedWithCustomError(esMPD, "NotAuthorizedMinter");
    });

    it("Should revert when burning from zero address", async function () {
      const { esMPD, minter } = await loadFixture(deployWithMinterFixture);
      const burnAmount = ethers.parseEther("100");

      await expect(
        esMPD.connect(minter).burn(ethers.ZeroAddress, burnAmount)
      ).to.be.revertedWithCustomError(esMPD, "ZeroAddress");
    });

    it("Should revert when burning zero amount", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);

      await expect(
        esMPD.connect(minter).burn(user.address, 0)
      ).to.be.revertedWithCustomError(esMPD, "ZeroAmount");
    });

    it("Should revert when burning more than balance", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("200");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      await expect(
        esMPD.connect(minter).burn(user.address, burnAmount)
      ).to.be.revertedWithCustomError(esMPD, "ERC20InsufficientBalance");
    });
  });

  // ============ 5. Transfer Blocking Tests ============

  describe("Transfer Blocking", function () {
    describe("Direct Transfer (transfer)", function () {
      it("Should revert when attempting direct transfer", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");
        const transferAmount = ethers.parseEther("500");

        await esMPD.connect(minter).mint(user.address, mintAmount);

        await expect(
          esMPD.connect(user).transfer(otherUser.address, transferAmount)
        ).to.be.revertedWithCustomError(esMPD, "TransfersDisabled");
      });

      it("Should revert when transferring entire balance", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");

        await esMPD.connect(minter).mint(user.address, mintAmount);

        await expect(
          esMPD.connect(user).transfer(otherUser.address, mintAmount)
        ).to.be.revertedWithCustomError(esMPD, "TransfersDisabled");
      });

      it("Should revert even when transferring zero amount", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");

        await esMPD.connect(minter).mint(user.address, mintAmount);

        await expect(
          esMPD.connect(user).transfer(otherUser.address, 0)
        ).to.be.revertedWithCustomError(esMPD, "TransfersDisabled");
      });
    });

    describe("TransferFrom", function () {
      it("Should revert when attempting transferFrom", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");
        const transferAmount = ethers.parseEther("500");

        await esMPD.connect(minter).mint(user.address, mintAmount);
        
        // Approve should work (doesn't trigger transfer)
        await esMPD.connect(user).approve(otherUser.address, transferAmount);

        // But transferFrom should revert
        await expect(
          esMPD.connect(otherUser).transferFrom(user.address, otherUser.address, transferAmount)
        ).to.be.revertedWithCustomError(esMPD, "TransfersDisabled");
      });

      it("Should revert transferFrom even with unlimited approval", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");

        await esMPD.connect(minter).mint(user.address, mintAmount);
        await esMPD.connect(user).approve(otherUser.address, ethers.MaxUint256);

        await expect(
          esMPD.connect(otherUser).transferFrom(user.address, otherUser.address, mintAmount)
        ).to.be.revertedWithCustomError(esMPD, "TransfersDisabled");
      });
    });

    describe("Approve", function () {
      it("Should allow approve (approval itself doesn't transfer)", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");
        const approvalAmount = ethers.parseEther("500");

        await esMPD.connect(minter).mint(user.address, mintAmount);

        // Approve should not revert
        await expect(
          esMPD.connect(user).approve(otherUser.address, approvalAmount)
        ).to.not.be.reverted;
      });

      it("Should track allowance correctly even though transfers are blocked", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");
        const approvalAmount = ethers.parseEther("500");

        await esMPD.connect(minter).mint(user.address, mintAmount);
        await esMPD.connect(user).approve(otherUser.address, approvalAmount);

        // Allowance is tracked but can't be used
        expect(await esMPD.allowance(user.address, otherUser.address)).to.equal(approvalAmount);
      });
    });

    describe("Balance Immutability", function () {
      it("Should maintain user balance after failed transfer attempt", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");

        await esMPD.connect(minter).mint(user.address, mintAmount);

        const balanceBefore = await esMPD.balanceOf(user.address);

        // Attempt transfer (will revert)
        await expect(
          esMPD.connect(user).transfer(otherUser.address, mintAmount)
        ).to.be.reverted;

        // Balance should be unchanged
        expect(await esMPD.balanceOf(user.address)).to.equal(balanceBefore);
      });

      it("Should not credit recipient after failed transfer", async function () {
        const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
        const mintAmount = ethers.parseEther("1000");

        await esMPD.connect(minter).mint(user.address, mintAmount);

        await expect(
          esMPD.connect(user).transfer(otherUser.address, mintAmount)
        ).to.be.reverted;

        // Recipient should have zero balance
        expect(await esMPD.balanceOf(otherUser.address)).to.equal(0);
      });
    });
  });

  // ============ 6. Event Tests ============

  describe("Events", function () {
    it("Should emit Transfer event when minting (from zero address)", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(esMPD.connect(minter).mint(user.address, mintAmount))
        .to.emit(esMPD, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, mintAmount);
    });

    it("Should emit TokensMinted event when minting", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      await expect(esMPD.connect(minter).mint(user.address, mintAmount))
        .to.emit(esMPD, "TokensMinted")
        .withArgs(user.address, mintAmount);
    });

    it("Should emit Transfer event when burning (to zero address)", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");
      const burnAmount = ethers.parseEther("500");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      await expect(esMPD.connect(minter).burn(user.address, burnAmount))
        .to.emit(esMPD, "Transfer")
        .withArgs(user.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should emit TokensBurned event when burning", async function () {
      const { esMPD, minter, user } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");
      const burnAmount = ethers.parseEther("500");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      await expect(esMPD.connect(minter).burn(user.address, burnAmount))
        .to.emit(esMPD, "TokensBurned")
        .withArgs(user.address, burnAmount);
    });

    it("Should emit Approval event when approving", async function () {
      const { esMPD, minter, user, otherUser } = await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");
      const approvalAmount = ethers.parseEther("500");

      await esMPD.connect(minter).mint(user.address, mintAmount);

      await expect(esMPD.connect(user).approve(otherUser.address, approvalAmount))
        .to.emit(esMPD, "Approval")
        .withArgs(user.address, otherUser.address, approvalAmount);
    });
  });
});

