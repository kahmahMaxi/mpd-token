// SPDX-License-Identifier: MIT
/**
 * @title MPD Token Suite Deployment Script
 * @notice Deploys MPDToken, EsMPD, and Vester contracts with proper permissions
 * @dev Run with: npx hardhat run scripts/deploy.js --network <network>
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ============ Configuration ============

const VESTING_DURATION = 365 * 24 * 60 * 60; // 365 days in seconds

// ============ Helper Functions ============

/**
 * @notice Ensures the deployments directory exists
 */
function ensureDeploymentsDir() {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  return deploymentsDir;
}

/**
 * @notice Writes deployment addresses to a JSON file
 */
function writeDeploymentFile(network, addresses) {
  const deploymentsDir = ensureDeploymentsDir();
  const filename = `${network}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  const deploymentData = {
    ...addresses,
    network: network,
    timestamp: new Date().toISOString(),
    vestingDuration: VESTING_DURATION,
  };
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n📄 Deployment addresses written to: ${filepath}`);
}

/**
 * @notice Prints a separator line
 */
function separator() {
  console.log("=".repeat(70));
}

// ============ Main Deployment Function ============

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  separator();
  console.log("🚀 MPD Token Suite Deployment");
  separator();
  console.log("Network:          ", network);
  console.log("Deployer:         ", deployer.address);
  console.log("Deployer Balance: ", hre.ethers.formatEther(
    await hre.ethers.provider.getBalance(deployer.address)
  ), "ETH");
  console.log("Vesting Duration: ", VESTING_DURATION, "seconds (365 days)");
  separator();

  // ============ Step 1: Deploy MPDToken ============
  
  console.log("\n📦 [1/3] Deploying MPDToken...");
  const MPDToken = await hre.ethers.getContractFactory("MPDToken");
  const mpdToken = await MPDToken.deploy(deployer.address);
  await mpdToken.waitForDeployment();
  const mpdTokenAddress = await mpdToken.getAddress();
  console.log("   ✅ MPDToken deployed to:", mpdTokenAddress);

  // ============ Step 2: Deploy EsMPD ============
  
  console.log("\n📦 [2/3] Deploying EsMPD...");
  const EsMPD = await hre.ethers.getContractFactory("EsMPD");
  const esMPD = await EsMPD.deploy(deployer.address);
  await esMPD.waitForDeployment();
  const esMPDAddress = await esMPD.getAddress();
  console.log("   ✅ EsMPD deployed to:", esMPDAddress);

  // ============ Step 3: Deploy Vester ============
  
  console.log("\n📦 [3/3] Deploying Vester...");
  const Vester = await hre.ethers.getContractFactory("Vester");
  const vester = await Vester.deploy(
    mpdTokenAddress,
    esMPDAddress,
    VESTING_DURATION,
    deployer.address
  );
  await vester.waitForDeployment();
  const vesterAddress = await vester.getAddress();
  console.log("   ✅ Vester deployed to:", vesterAddress);

  // ============ Step 4: Configure Permissions ============
  
  console.log("\n🔐 Configuring permissions...");

  // 4a. Transfer MPDToken ownership to Vester (so Vester can mint MPD)
  console.log("   • Transferring MPDToken ownership to Vester...");
  const transferOwnershipTx = await mpdToken.transferOwnership(vesterAddress);
  await transferOwnershipTx.wait();
  console.log("     ✅ MPDToken ownership transferred to Vester");

  // 4b. Set deployer as minter for EsMPD (for initial distribution)
  console.log("   • Setting deployer as EsMPD minter...");
  const setDeployerMinterTx = await esMPD.setMinter(deployer.address, true);
  await setDeployerMinterTx.wait();
  console.log("     ✅ Deployer set as EsMPD minter");

  // 4c. Set Vester as minter for EsMPD (for burn on deposit, mint on withdraw)
  console.log("   • Setting Vester as EsMPD minter...");
  const setVesterMinterTx = await esMPD.setMinter(vesterAddress, true);
  await setVesterMinterTx.wait();
  console.log("     ✅ Vester set as EsMPD minter");

  // ============ Step 5: Verify Configuration ============
  
  console.log("\n🔍 Verifying configuration...");
  
  const mpdOwner = await mpdToken.owner();
  const isDeployerEsMPDMinter = await esMPD.isMinter(deployer.address);
  const isVesterEsMPDMinter = await esMPD.isMinter(vesterAddress);
  const vesterMPDAddress = await vester.mpd();
  const vesterEsMPDAddress = await vester.esMpd();
  const vesterDuration = await vester.vestingDuration();

  console.log("   • MPDToken owner:", mpdOwner);
  console.log("   • Deployer is EsMPD minter:", isDeployerEsMPDMinter);
  console.log("   • Vester is EsMPD minter:", isVesterEsMPDMinter);
  console.log("   • Vester.mpd():", vesterMPDAddress);
  console.log("   • Vester.esMpd():", vesterEsMPDAddress);
  console.log("   • Vester.vestingDuration():", vesterDuration.toString(), "seconds");

  // Validation checks
  if (mpdOwner !== vesterAddress) {
    console.log("   ⚠️  Warning: MPDToken owner is not Vester!");
  }
  if (!isVesterEsMPDMinter) {
    console.log("   ⚠️  Warning: Vester is not an EsMPD minter!");
  }

  // ============ Step 6: Summary ============
  
  separator();
  console.log("📋 DEPLOYMENT SUMMARY");
  separator();
  console.log("Contract        | Address");
  separator();
  console.log(`MPDToken        | ${mpdTokenAddress}`);
  console.log(`EsMPD           | ${esMPDAddress}`);
  console.log(`Vester          | ${vesterAddress}`);
  separator();
  console.log("Deployer:       ", deployer.address);
  console.log("Network:        ", network);
  separator();

  // ============ Step 7: Write Deployment File ============
  
  const addresses = {
    MPDToken: mpdTokenAddress,
    esMPD: esMPDAddress,
    Vester: vesterAddress,
    deployer: deployer.address,
  };

  writeDeploymentFile(network === "hardhat" ? "local" : network, addresses);

  // ============ Step 8: Verification Instructions ============
  
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\n📋 Contract Verification Commands:");
    separator();
    console.log(`npx hardhat verify --network ${network} ${mpdTokenAddress} ${deployer.address}`);
    console.log(`npx hardhat verify --network ${network} ${esMPDAddress} ${deployer.address}`);
    console.log(`npx hardhat verify --network ${network} ${vesterAddress} ${mpdTokenAddress} ${esMPDAddress} ${VESTING_DURATION} ${deployer.address}`);
    separator();
  }

  console.log("\n✅ Deployment complete!\n");

  return addresses;
}

// ============ Execute ============

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
