// SPDX-License-Identifier: MIT
/**
 * @title MPD Token Test Suite
 * @notice Tests for MPDToken and EsMPD contracts
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MPD Token Suite", function () {
  
  // ============ Fixtures ============

  async function deployTokensFixture() {
    const [owner, user1, user2, minter] = await ethers.getSigners();

    // Deploy MPDToken
    const MPDToken = await ethers.getContractFactory("MPDToken");
    const mpdToken = await MPDToken.deploy(owner.address);

    // Deploy EsMPD
    const EsMPD = await ethers.getContractFactory("EsMPD");
    const esMPD = await EsMPD.deploy(owner.address);

    return { mpdToken, esMPD, owner, user1, user2, minter };
  }

  // ============ MPDToken Tests ============

  describe("MPDToken", function () {
    
    describe("Deployment", function () {
      it("Should set the correct name and symbol", async function () {
        const { mpdToken } = await loadFixture(deployTokensFixture);
        
        expect(await mpdToken.name()).to.equal("MPD Token");
        expect(await mpdToken.symbol()).to.equal("MPD");
      });

      it("Should set the correct owner", async function () {
        const { mpdToken, owner } = await loadFixture(deployTokensFixture);
        
        expect(await mpdToken.owner()).to.equal(owner.address);
      });

      it("Should have 18 decimals", async function () {
        const { mpdToken } = await loadFixture(deployTokensFixture);
        
        expect(await mpdToken.decimals()).to.equal(18);
      });

      it("Should start with zero total supply", async function () {
        const { mpdToken } = await loadFixture(deployTokensFixture);
        
        expect(await mpdToken.totalSupply()).to.equal(0);
      });
    });

    describe("Minting", function () {
      it("Should allow owner to mint tokens", async function () {
        const { mpdToken, owner, user1 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("1000");

        await expect(mpdToken.mint(user1.address, mintAmount))
          .to.emit(mpdToken, "TokensMinted")
          .withArgs(user1.address, mintAmount);

        expect(await mpdToken.balanceOf(user1.address)).to.equal(mintAmount);
      });

      it("Should reject minting from non-owner", async function () {
        const { mpdToken, user1, user2 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("1000");

        await expect(mpdToken.connect(user1).mint(user2.address, mintAmount))
          .to.be.revertedWithCustomError(mpdToken, "OwnableUnauthorizedAccount");
      });

      it("Should reject minting to zero address", async function () {
        const { mpdToken } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("1000");

        await expect(mpdToken.mint(ethers.ZeroAddress, mintAmount))
          .to.be.revertedWith("MPDToken: mint to zero address");
      });

      it("Should reject minting zero amount", async function () {
        const { mpdToken, user1 } = await loadFixture(deployTokensFixture);

        await expect(mpdToken.mint(user1.address, 0))
          .to.be.revertedWith("MPDToken: mint amount must be greater than zero");
      });
    });

    describe("Transfers", function () {
      it("Should allow token transfers", async function () {
        const { mpdToken, owner, user1, user2 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("1000");
        const transferAmount = ethers.parseEther("100");

        await mpdToken.mint(user1.address, mintAmount);
        await mpdToken.connect(user1).transfer(user2.address, transferAmount);

        expect(await mpdToken.balanceOf(user2.address)).to.equal(transferAmount);
      });
    });
  });

  // ============ EsMPD Tests ============

  describe("EsMPD", function () {
    
    describe("Deployment", function () {
      it("Should set the correct name and symbol", async function () {
        const { esMPD } = await loadFixture(deployTokensFixture);
        
        expect(await esMPD.name()).to.equal("Escrowed MPD");
        expect(await esMPD.symbol()).to.equal("esMPD");
      });

      it("Should set the correct owner", async function () {
        const { esMPD, owner } = await loadFixture(deployTokensFixture);
        
        expect(await esMPD.owner()).to.equal(owner.address);
      });
    });

    describe("Minter Management", function () {
      it("Should allow owner to set minter", async function () {
        const { esMPD, owner, minter } = await loadFixture(deployTokensFixture);

        await expect(esMPD.setMinter(minter.address, true))
          .to.emit(esMPD, "MinterSet")
          .withArgs(minter.address, true);

        expect(await esMPD.isMinter(minter.address)).to.be.true;
      });

      it("Should reject setting minter from non-owner", async function () {
        const { esMPD, user1, minter } = await loadFixture(deployTokensFixture);

        await expect(esMPD.connect(user1).setMinter(minter.address, true))
          .to.be.revertedWithCustomError(esMPD, "OwnableUnauthorizedAccount");
      });
    });

    describe("Minting", function () {
      it("Should allow minter to mint tokens", async function () {
        const { esMPD, owner, minter, user1 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("500");

        await esMPD.setMinter(minter.address, true);
        
        await expect(esMPD.connect(minter).mint(user1.address, mintAmount))
          .to.emit(esMPD, "TokensMinted")
          .withArgs(user1.address, mintAmount);

        expect(await esMPD.balanceOf(user1.address)).to.equal(mintAmount);
      });

      it("Should reject minting from non-minter", async function () {
        const { esMPD, user1, user2 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("500");

        await expect(esMPD.connect(user1).mint(user2.address, mintAmount))
          .to.be.revertedWithCustomError(esMPD, "NotAuthorizedMinter");
      });
    });

    describe("Burning", function () {
      it("Should allow minter to burn tokens", async function () {
        const { esMPD, owner, minter, user1 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("500");
        const burnAmount = ethers.parseEther("200");

        await esMPD.setMinter(minter.address, true);
        await esMPD.connect(minter).mint(user1.address, mintAmount);
        
        await expect(esMPD.connect(minter).burn(user1.address, burnAmount))
          .to.emit(esMPD, "TokensBurned")
          .withArgs(user1.address, burnAmount);

        expect(await esMPD.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
      });
    });

    describe("Non-Transferability", function () {
      it("Should block direct transfers", async function () {
        const { esMPD, owner, minter, user1, user2 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("500");

        await esMPD.setMinter(minter.address, true);
        await esMPD.connect(minter).mint(user1.address, mintAmount);

        await expect(esMPD.connect(user1).transfer(user2.address, mintAmount))
          .to.be.revertedWithCustomError(esMPD, "TransfersDisabled");
      });

      it("Should block transferFrom", async function () {
        const { esMPD, owner, minter, user1, user2 } = await loadFixture(deployTokensFixture);
        const mintAmount = ethers.parseEther("500");

        await esMPD.setMinter(minter.address, true);
        await esMPD.connect(minter).mint(user1.address, mintAmount);
        await esMPD.connect(user1).approve(user2.address, mintAmount);

        await expect(esMPD.connect(user2).transferFrom(user1.address, user2.address, mintAmount))
          .to.be.revertedWithCustomError(esMPD, "TransfersDisabled");
      });
    });
  });
});

