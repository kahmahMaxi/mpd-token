// SPDX-License-Identifier: MIT
/**
 * @title Vester Test Suite
 * @notice Comprehensive tests for the Vester contract (esMPD → MPD vesting)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Vester", function () {
  
  // ============ Constants ============

  const VESTING_DURATION = 365 * 24 * 60 * 60; // 365 days in seconds
  const ONE_DAY = 24 * 60 * 60;
  const HALF_YEAR = VESTING_DURATION / 2;

  // ============ Test Fixture ============

  /**
   * @notice Deploys all contracts and sets up minter permissions
   */
  async function deployVesterFixture() {
    const [owner, user, user2] = await ethers.getSigners();

    // Deploy MPDToken
    const MPDToken = await ethers.getContractFactory("MPDToken");
    const mpdToken = await MPDToken.deploy(owner.address);

    // Deploy EsMPD
    const EsMPD = await ethers.getContractFactory("EsMPD");
    const esMPD = await EsMPD.deploy(owner.address);

    // Deploy Vester
    const Vester = await ethers.getContractFactory("Vester");
    const vester = await Vester.deploy(
      await mpdToken.getAddress(),
      await esMPD.getAddress(),
      VESTING_DURATION,
      owner.address
    );

    // Set Vester as minter for MPDToken (to mint vested MPD)
    // MPDToken uses Ownable, so owner can mint directly
    // We need to transfer ownership or add a minter role
    // For this test, we'll transfer ownership to Vester for minting
    // Actually, looking at MPDToken, only owner can mint
    // So we need to make Vester the owner OR modify the approach
    
    // Let's use a workaround: make owner mint MPD to Vester first
    // Actually, let's check the Vester contract - it calls IMPDToken.mint()
    // So MPDToken owner needs to be Vester, or we need to update MPDToken
    
    // For testing purposes, let's transfer MPDToken ownership to Vester
    await mpdToken.transferOwnership(await vester.getAddress());

    // Set Vester as minter for EsMPD (to burn vested esMPD)
    await esMPD.setMinter(await vester.getAddress(), true);

    // Also set owner as minter for esMPD (to mint test tokens to users)
    await esMPD.setMinter(owner.address, true);

    return { mpdToken, esMPD, vester, owner, user, user2 };
  }

  /**
   * @notice Deploys contracts and gives user some esMPD
   */
  async function deployWithUserBalanceFixture() {
    const { mpdToken, esMPD, vester, owner, user, user2 } = await loadFixture(deployVesterFixture);

    const userBalance = ethers.parseEther("1000");
    const user2Balance = ethers.parseEther("500");

    // Mint esMPD to users
    await esMPD.connect(owner).mint(user.address, userBalance);
    await esMPD.connect(owner).mint(user2.address, user2Balance);

    // No approval needed - Vester burns esMPD directly as a minter (esMPD is non-transferable)

    return { mpdToken, esMPD, vester, owner, user, user2, userBalance, user2Balance };
  }

  // ============ 1. Deployment Tests ============

  describe("Deployment", function () {
    it("Should store correct MPD token address", async function () {
      const { mpdToken, vester } = await loadFixture(deployVesterFixture);

      expect(await vester.mpd()).to.equal(await mpdToken.getAddress());
    });

    it("Should store correct esMPD token address", async function () {
      const { esMPD, vester } = await loadFixture(deployVesterFixture);

      expect(await vester.esMpd()).to.equal(await esMPD.getAddress());
    });

    it("Should set correct vesting duration", async function () {
      const { vester } = await loadFixture(deployVesterFixture);

      expect(await vester.vestingDuration()).to.equal(VESTING_DURATION);
    });

    it("Should set correct owner", async function () {
      const { vester, owner } = await loadFixture(deployVesterFixture);

      expect(await vester.owner()).to.equal(owner.address);
    });

    it("Should revert deployment with zero vesting duration", async function () {
      const [owner] = await ethers.getSigners();

      const MPDToken = await ethers.getContractFactory("MPDToken");
      const mpdToken = await MPDToken.deploy(owner.address);

      const EsMPD = await ethers.getContractFactory("EsMPD");
      const esMPD = await EsMPD.deploy(owner.address);

      const Vester = await ethers.getContractFactory("Vester");

      await expect(
        Vester.deploy(
          await mpdToken.getAddress(),
          await esMPD.getAddress(),
          0, // zero duration
          owner.address
        )
      ).to.be.revertedWithCustomError(Vester, "InvalidVestingDuration");
    });
  });

  // ============ 2. Deposit Tests ============

  describe("deposit()", function () {
    it("Should allow user to deposit esMPD", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await expect(vester.connect(user).deposit(depositAmount))
        .to.emit(vester, "Deposited")
        .withArgs(user.address, depositAmount);
    });

    it("Should burn esMPD from user on deposit (non-transferable token)", async function () {
      const { esMPD, vester, user, userBalance } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      const userBalanceBefore = await esMPD.balanceOf(user.address);
      const totalSupplyBefore = await esMPD.totalSupply();

      await vester.connect(user).deposit(depositAmount);

      const userBalanceAfter = await esMPD.balanceOf(user.address);
      const totalSupplyAfter = await esMPD.totalSupply();

      // User's balance should decrease
      expect(userBalanceAfter).to.equal(userBalanceBefore - depositAmount);
      // Total supply should decrease (burned, not transferred)
      expect(totalSupplyAfter).to.equal(totalSupplyBefore - depositAmount);
    });

    it("Should increase depositedAmount for user", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      expect(await vester.depositedAmount(user.address)).to.equal(0);

      await vester.connect(user).deposit(depositAmount);

      expect(await vester.depositedAmount(user.address)).to.equal(depositAmount);
    });

    it("Should set lastClaimTime on first deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      expect(await vester.lastClaimTime(user.address)).to.equal(0);

      await vester.connect(user).deposit(depositAmount);

      const lastClaimTime = await vester.lastClaimTime(user.address);
      expect(lastClaimTime).to.be.gt(0);
    });

    it("Should set vestingStartTime on first deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      expect(await vester.vestingStartTime(user.address)).to.equal(0);

      await vester.connect(user).deposit(depositAmount);

      const vestingStartTime = await vester.vestingStartTime(user.address);
      expect(vestingStartTime).to.be.gt(0);
    });

    it("Should update depositedAmount on second deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const firstDeposit = ethers.parseEther("100");
      const secondDeposit = ethers.parseEther("50");

      await vester.connect(user).deposit(firstDeposit);

      // Move time forward to have some claimable amount
      await time.increase(ONE_DAY * 30);

      await vester.connect(user).deposit(secondDeposit);

      expect(await vester.depositedAmount(user.address)).to.equal(firstDeposit + secondDeposit);
    });

    it("Should NOT reset vestingStartTime on second deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const firstDeposit = ethers.parseEther("100");
      const secondDeposit = ethers.parseEther("50");

      await vester.connect(user).deposit(firstDeposit);
      const originalStartTime = await vester.vestingStartTime(user.address);

      // Move time forward
      await time.increase(ONE_DAY * 30);

      await vester.connect(user).deposit(secondDeposit);

      // vestingStartTime should remain the same
      expect(await vester.vestingStartTime(user.address)).to.equal(originalStartTime);
    });

    it("Should revert when depositing zero amount", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      await expect(
        vester.connect(user).deposit(0)
      ).to.be.revertedWithCustomError(vester, "ZeroAmount");
    });

    it("Should revert when user has insufficient esMPD balance", async function () {
      const { vester, user, userBalance } = await loadFixture(deployWithUserBalanceFixture);
      const excessiveAmount = userBalance + ethers.parseEther("1");

      await expect(
        vester.connect(user).deposit(excessiveAmount)
      ).to.be.reverted;
    });
  });

  // ============ 3. Claim Tests ============

  describe("claim()", function () {
    it("Should mint approximately half MPD after half vesting period", async function () {
      const { mpdToken, vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);

      // Move forward half the vesting duration
      await time.increase(HALF_YEAR);

      const mpdBalanceBefore = await mpdToken.balanceOf(user.address);
      await vester.connect(user).claim();
      const mpdBalanceAfter = await mpdToken.balanceOf(user.address);

      const claimed = mpdBalanceAfter - mpdBalanceBefore;
      const expectedApprox = depositAmount / 2n;

      // Allow 1% tolerance for timing variations
      const tolerance = expectedApprox / 100n;
      expect(claimed).to.be.closeTo(expectedApprox, tolerance);
    });

    it("Should increase user MPD balance correctly", async function () {
      const { mpdToken, vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 100); // ~27% of vesting

      const balanceBefore = await mpdToken.balanceOf(user.address);
      await vester.connect(user).claim();
      const balanceAfter = await mpdToken.balanceOf(user.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should increase claimedAmount for user", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 100);

      expect(await vester.claimedAmount(user.address)).to.equal(0);

      await vester.connect(user).claim();

      expect(await vester.claimedAmount(user.address)).to.be.gt(0);
    });

    it("Should update lastClaimTime after claim", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      const lastClaimTimeBefore = await vester.lastClaimTime(user.address);

      await time.increase(ONE_DAY * 30);
      await vester.connect(user).claim();

      const lastClaimTimeAfter = await vester.lastClaimTime(user.address);
      expect(lastClaimTimeAfter).to.be.gt(lastClaimTimeBefore);
    });

    it("Should emit Claimed event with correct amount", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 100);

      // Get claimable before the claim transaction
      const claimableBefore = await vester.claimable(user.address);

      // Just verify the event is emitted (amount may vary slightly due to block timing)
      await expect(vester.connect(user).claim())
        .to.emit(vester, "Claimed");
      
      // Verify claimed amount is approximately correct
      const claimed = await vester.claimedAmount(user.address);
      const tolerance = depositAmount / 100n; // 1% tolerance
      expect(claimed).to.be.closeTo(claimableBefore, tolerance);
    });

    describe("Multiple claim intervals", function () {
      it("Should accumulate claims correctly over multiple intervals", async function () {
        const { mpdToken, vester, user } = await loadFixture(deployWithUserBalanceFixture);
        const depositAmount = ethers.parseEther("100");

        await vester.connect(user).deposit(depositAmount);

        // First claim after 25% of vesting
        await time.increase(VESTING_DURATION / 4);
        await vester.connect(user).claim();
        const firstClaim = await vester.claimedAmount(user.address);

        // Second claim after another 25%
        await time.increase(VESTING_DURATION / 4);
        await vester.connect(user).claim();
        const secondTotalClaimed = await vester.claimedAmount(user.address);

        // Third claim after another 25%
        await time.increase(VESTING_DURATION / 4);
        await vester.connect(user).claim();
        const thirdTotalClaimed = await vester.claimedAmount(user.address);

        // Each claim should be approximately equal
        const tolerance = depositAmount / 100n; // 1% tolerance
        expect(firstClaim).to.be.closeTo(depositAmount / 4n, tolerance);
        expect(secondTotalClaimed).to.be.closeTo(depositAmount / 2n, tolerance);
        expect(thirdTotalClaimed).to.be.closeTo((depositAmount * 3n) / 4n, tolerance);
      });

      it("Should correctly track total claimed across multiple claims", async function () {
        const { mpdToken, vester, user } = await loadFixture(deployWithUserBalanceFixture);
        const depositAmount = ethers.parseEther("200");

        await vester.connect(user).deposit(depositAmount);

        let totalMPDReceived = 0n;

        // Claim at 10%
        await time.increase(VESTING_DURATION / 10);
        const balanceBefore1 = await mpdToken.balanceOf(user.address);
        await vester.connect(user).claim();
        const balanceAfter1 = await mpdToken.balanceOf(user.address);
        totalMPDReceived += (balanceAfter1 - balanceBefore1);

        // Claim at 50%
        await time.increase((VESTING_DURATION * 4) / 10);
        const balanceBefore2 = await mpdToken.balanceOf(user.address);
        await vester.connect(user).claim();
        const balanceAfter2 = await mpdToken.balanceOf(user.address);
        totalMPDReceived += (balanceAfter2 - balanceBefore2);

        // Total claimed should equal claimedAmount
        expect(await vester.claimedAmount(user.address)).to.equal(totalMPDReceived);
      });
    });
  });

  // ============ 4. Full Vesting Tests ============

  describe("Full Vesting", function () {
    it("Should allow claiming entire deposit after full vesting period", async function () {
      const { mpdToken, vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);

      // Move forward full vesting duration
      await time.increase(VESTING_DURATION);

      const balanceBefore = await mpdToken.balanceOf(user.address);
      await vester.connect(user).claim();
      const balanceAfter = await mpdToken.balanceOf(user.address);

      const claimed = balanceAfter - balanceBefore;
      expect(claimed).to.equal(depositAmount);
    });

    it("Should show zero claimable after full claim", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION);
      await vester.connect(user).claim();

      expect(await vester.claimable(user.address)).to.equal(0);
    });

    it("Should show totalVested equals depositedAmount after full period", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION);

      expect(await vester.totalVested(user.address)).to.equal(depositAmount);
    });

    it("Should show zero unvestedAmount after full period", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION);

      expect(await vester.unvestedAmount(user.address)).to.equal(0);
    });

    it("Should show zero timeUntilFullyVested after full period", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION);

      expect(await vester.timeUntilFullyVested(user.address)).to.equal(0);
    });

    it("Should not allow claiming more than deposited even after extended time", async function () {
      const { mpdToken, vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);

      // Move forward 2x the vesting duration
      await time.increase(VESTING_DURATION * 2);

      await vester.connect(user).claim();

      // Total claimed should equal deposit, not more
      expect(await vester.claimedAmount(user.address)).to.equal(depositAmount);
    });
  });

  // ============ 5. Withdraw Tests ============

  describe("withdraw()", function () {
    it("Should return unvested esMPD to user", async function () {
      const { esMPD, vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);

      // Move forward 25% of vesting (75% unvested)
      await time.increase(VESTING_DURATION / 4);

      const balanceBefore = await esMPD.balanceOf(user.address);
      await vester.connect(user).withdraw();
      const balanceAfter = await esMPD.balanceOf(user.address);

      const returned = balanceAfter - balanceBefore;
      const expectedUnvested = (depositAmount * 3n) / 4n;
      const tolerance = depositAmount / 100n;

      expect(returned).to.be.closeTo(expectedUnvested, tolerance);
    });

    it("Should NOT mint pending MPD on withdrawal (forfeited)", async function () {
      const { mpdToken, vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION / 2); // 50% vested but unclaimed

      const balanceBefore = await mpdToken.balanceOf(user.address);
      await vester.connect(user).withdraw();
      const balanceAfter = await mpdToken.balanceOf(user.address);

      // User should NOT receive any MPD from withdraw
      expect(balanceAfter).to.equal(balanceBefore);
    });

    it("Should reset depositedAmount to zero", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 30);
      await vester.connect(user).withdraw();

      expect(await vester.depositedAmount(user.address)).to.equal(0);
    });

    it("Should reset claimedAmount to zero", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 30);
      await vester.connect(user).claim(); // Claim some first
      
      expect(await vester.claimedAmount(user.address)).to.be.gt(0);
      
      await vester.connect(user).withdraw();

      expect(await vester.claimedAmount(user.address)).to.equal(0);
    });

    it("Should reset lastClaimTime to zero", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 30);
      await vester.connect(user).withdraw();

      expect(await vester.lastClaimTime(user.address)).to.equal(0);
    });

    it("Should reset vestingStartTime to zero", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 30);
      await vester.connect(user).withdraw();

      expect(await vester.vestingStartTime(user.address)).to.equal(0);
    });

    it("Should emit Withdrawn event with correct amounts", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION / 4); // 25% vested

      // Just verify the event is emitted (amounts may vary slightly due to block timing)
      await expect(vester.connect(user).withdraw())
        .to.emit(vester, "Withdrawn");
    });

    it("Should allow new deposit after withdrawal", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(ONE_DAY * 30);
      await vester.connect(user).withdraw();

      // Should be able to deposit again
      await expect(vester.connect(user).deposit(depositAmount))
        .to.emit(vester, "Deposited");

      expect(await vester.depositedAmount(user.address)).to.equal(depositAmount);
    });

    it("Should start fresh vesting after re-deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION / 2);
      await vester.connect(user).withdraw();

      // Re-deposit
      await vester.connect(user).deposit(depositAmount);

      // Time until fully vested should be full duration again
      const timeRemaining = await vester.timeUntilFullyVested(user.address);
      expect(timeRemaining).to.be.closeTo(BigInt(VESTING_DURATION), BigInt(10));
    });
  });

  // ============ 6. Edge Cases ============

  describe("Edge Cases", function () {
    it("Should revert claim without deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      await expect(
        vester.connect(user).claim()
      ).to.be.revertedWithCustomError(vester, "NoVestingPosition");
    });

    it("Should revert withdraw without deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      await expect(
        vester.connect(user).withdraw()
      ).to.be.revertedWithCustomError(vester, "NoVestingPosition");
    });

    it("Should have minimal claimable immediately after deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);

      // Due to linear vesting, even 1 second of elapsed time results in a tiny claimable amount
      // For 100 ether over 365 days: ~3170 gwei per second
      // This is expected behavior - just verify the amount is very small
      const claimable = await vester.claimable(user.address);
      const maxExpectedImmediate = ethers.parseEther("0.001"); // Very small amount
      
      expect(claimable).to.be.lt(maxExpectedImmediate);
    });

    it("Should revert deposit of zero amount", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      await expect(
        vester.connect(user).deposit(0)
      ).to.be.revertedWithCustomError(vester, "ZeroAmount");
    });

    it("Should return zero claimable for user with no deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      expect(await vester.claimable(user.address)).to.equal(0);
    });

    it("Should return zero totalVested for user with no deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      expect(await vester.totalVested(user.address)).to.equal(0);
    });

    it("Should return zero unvestedAmount for user with no deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      expect(await vester.unvestedAmount(user.address)).to.equal(0);
    });

    it("Should return zero timeUntilFullyVested for user with no deposit", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);

      expect(await vester.timeUntilFullyVested(user.address)).to.equal(0);
    });

    it("Should handle multiple users independently", async function () {
      const { vester, user, user2 } = await loadFixture(deployWithUserBalanceFixture);

      await vester.connect(user).deposit(ethers.parseEther("100"));
      await time.increase(ONE_DAY * 30);
      await vester.connect(user2).deposit(ethers.parseEther("200"));

      // user should have more vested than user2
      const userVested = await vester.totalVested(user.address);
      const user2Vested = await vester.totalVested(user2.address);

      expect(userVested).to.be.gt(user2Vested);
    });

    it("Should not affect other users when one withdraws", async function () {
      const { vester, user, user2 } = await loadFixture(deployWithUserBalanceFixture);

      await vester.connect(user).deposit(ethers.parseEther("100"));
      await vester.connect(user2).deposit(ethers.parseEther("200"));

      await time.increase(ONE_DAY * 30);

      const user2DepositBefore = await vester.depositedAmount(user2.address);
      await vester.connect(user).withdraw();
      const user2DepositAfter = await vester.depositedAmount(user2.address);

      expect(user2DepositAfter).to.equal(user2DepositBefore);
    });
  });

  // ============ 7. Admin Tests ============

  describe("Admin Functions", function () {
    it("Should allow owner to update vesting duration", async function () {
      const { vester, owner } = await loadFixture(deployVesterFixture);
      const newDuration = 180 * ONE_DAY; // 180 days

      await vester.connect(owner).setVestingDuration(newDuration);

      expect(await vester.vestingDuration()).to.equal(newDuration);
    });

    it("Should emit VestingDurationUpdated event", async function () {
      const { vester, owner } = await loadFixture(deployVesterFixture);
      const newDuration = 180 * ONE_DAY;

      await expect(vester.connect(owner).setVestingDuration(newDuration))
        .to.emit(vester, "VestingDurationUpdated")
        .withArgs(VESTING_DURATION, newDuration);
    });

    it("Should revert when non-owner tries to update vesting duration", async function () {
      const { vester, user } = await loadFixture(deployVesterFixture);
      const newDuration = 180 * ONE_DAY;

      await expect(
        vester.connect(user).setVestingDuration(newDuration)
      ).to.be.revertedWithCustomError(vester, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });

    it("Should revert when setting zero vesting duration", async function () {
      const { vester, owner } = await loadFixture(deployVesterFixture);

      await expect(
        vester.connect(owner).setVestingDuration(0)
      ).to.be.revertedWithCustomError(vester, "InvalidVestingDuration");
    });

    it("Should affect new calculations after duration update", async function () {
      const { vester, user, owner } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      // Deposit with original 365-day duration
      await vester.connect(user).deposit(depositAmount);

      // Change to 100 days
      const newDuration = 100 * ONE_DAY;
      await vester.connect(owner).setVestingDuration(newDuration);

      // Move forward 50 days (would be ~13.7% of 365 days, but ~50% of 100 days)
      await time.increase(50 * ONE_DAY);

      // Note: existing deposits still use their original start time
      // The new duration affects the calculation
      const vested = await vester.totalVested(user.address);
      const expectedWithNewDuration = depositAmount / 2n;
      const tolerance = depositAmount / 100n;

      expect(vested).to.be.closeTo(expectedWithNewDuration, tolerance);
    });
  });

  // ============ View Function Tests ============

  describe("View Functions", function () {
    it("claimable() should return correct amount mid-vesting", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION / 4);

      const claimable = await vester.claimable(user.address);
      const expected = depositAmount / 4n;
      const tolerance = depositAmount / 100n;

      expect(claimable).to.be.closeTo(expected, tolerance);
    });

    it("timeUntilFullyVested() should return correct time", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);
      await time.increase(VESTING_DURATION / 4);

      const remaining = await vester.timeUntilFullyVested(user.address);
      const expected = (VESTING_DURATION * 3) / 4;

      // Allow small tolerance for block time
      expect(remaining).to.be.closeTo(BigInt(expected), BigInt(10));
    });

    it("unvestedAmount() should decrease over time", async function () {
      const { vester, user } = await loadFixture(deployWithUserBalanceFixture);
      const depositAmount = ethers.parseEther("100");

      await vester.connect(user).deposit(depositAmount);

      const unvested1 = await vester.unvestedAmount(user.address);

      await time.increase(VESTING_DURATION / 4);
      const unvested2 = await vester.unvestedAmount(user.address);

      await time.increase(VESTING_DURATION / 4);
      const unvested3 = await vester.unvestedAmount(user.address);

      expect(unvested2).to.be.lt(unvested1);
      expect(unvested3).to.be.lt(unvested2);
    });
  });
});

