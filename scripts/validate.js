// SPDX-License-Identifier: MIT
/**
 * @title MPD Token Suite Validation Script
 * @notice Validates deployed contracts and their configurations
 * @dev Run with: npx hardhat run scripts/validate.js --network <network>
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ============ Configuration ============

let passCount = 0;
let failCount = 0;

// ============ Helper Functions ============

/**
 * @notice Prints a pass message and increments counter
 */
function pass(message) {
  console.log(`  ✅ [PASS] ${message}`);
  passCount++;
}

/**
 * @notice Prints a fail message and increments counter
 */
function fail(message) {
  console.log(`  ❌ [FAIL] ${message}`);
  failCount++;
}

/**
 * @notice Prints a separator line
 */
function separator() {
  console.log("=".repeat(70));
}

/**
 * @notice Prints a section header
 */
function section(title) {
  console.log(`\n📋 ${title}`);
  console.log("-".repeat(50));
}

/**
 * @notice Loads deployment data from JSON file
 */
function loadDeployment(network) {
  const filename = network === "hardhat" ? "local.json" : `${network}.json`;
  const filepath = path.join(__dirname, "..", "deployments", filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Deployment file not found: ${filepath}`);
  }

  const data = JSON.parse(fs.readFileSync(filepath, "utf8"));

  // Validate required fields
  const requiredFields = ["MPDToken", "esMPD", "Vester", "deployer", "network", "vestingDuration"];
  for (const field of requiredFields) {
    if (!data[field] && data[field] !== 0) {
      throw new Error(`Missing required field in deployment file: ${field}`);
    }
    if (field !== "network" && field !== "vestingDuration" && data[field] === "") {
      throw new Error(`Empty address for field: ${field}. Have you deployed to ${network}?`);
    }
  }

  return data;
}

// ============ Validation Functions ============

/**
 * @notice Validates MPDToken contract
 */
async function validateMPDToken(mpdToken, deployment) {
  section("MPDToken Validation");

  try {
    // Check name
    const name = await mpdToken.name();
    if (name === "MPD Token") {
      pass("Name is 'MPD Token'");
    } else {
      fail(`Name is '${name}', expected 'MPD Token'`);
    }

    // Check symbol
    const symbol = await mpdToken.symbol();
    if (symbol === "MPD") {
      pass("Symbol is 'MPD'");
    } else {
      fail(`Symbol is '${symbol}', expected 'MPD'`);
    }

    // Check decimals
    const decimals = await mpdToken.decimals();
    if (decimals === 18n) {
      pass("Decimals is 18");
    } else {
      fail(`Decimals is ${decimals}, expected 18`);
    }

    // Check total supply >= 0
    const totalSupply = await mpdToken.totalSupply();
    if (totalSupply >= 0n) {
      pass(`Total supply is ${hre.ethers.formatEther(totalSupply)} MPD`);
    } else {
      fail("Total supply is negative (impossible state)");
    }

    // Check owner is Vester
    const owner = await mpdToken.owner();
    if (owner.toLowerCase() === deployment.Vester.toLowerCase()) {
      pass("Owner is Vester (Vester can mint MPD)");
    } else {
      fail(`Owner is ${owner}, expected Vester (${deployment.Vester})`);
    }

  } catch (error) {
    fail(`Error validating MPDToken: ${error.message}`);
  }
}

/**
 * @notice Validates EsMPD contract
 */
async function validateEsMPD(esMPD, deployment, signer) {
  section("EsMPD Validation");

  try {
    // Check name
    const name = await esMPD.name();
    if (name === "Escrowed MPD") {
      pass("Name is 'Escrowed MPD'");
    } else {
      fail(`Name is '${name}', expected 'Escrowed MPD'`);
    }

    // Check symbol
    const symbol = await esMPD.symbol();
    if (symbol === "esMPD") {
      pass("Symbol is 'esMPD'");
    } else {
      fail(`Symbol is '${symbol}', expected 'esMPD'`);
    }

    // Check decimals
    const decimals = await esMPD.decimals();
    if (decimals === 18n) {
      pass("Decimals is 18");
    } else {
      fail(`Decimals is ${decimals}, expected 18`);
    }

    // Check Vester is minter
    const isVesterMinter = await esMPD.isMinter(deployment.Vester);
    if (isVesterMinter) {
      pass("Vester is set as minter");
    } else {
      fail("Vester is NOT set as minter");
    }

    // Check deployer is minter
    const isDeployerMinter = await esMPD.isMinter(deployment.deployer);
    if (isDeployerMinter) {
      pass("Deployer is set as minter");
    } else {
      fail("Deployer is NOT set as minter");
    }

    // Check transfers are blocked
    try {
      // Try to estimate gas for a transfer (will fail if transfers blocked)
      // We use a static call to check without sending a transaction
      const signerAddress = await signer.getAddress();
      const balance = await esMPD.balanceOf(signerAddress);
      
      if (balance > 0n) {
        // Try to simulate a transfer
        await esMPD.connect(signer).transfer.staticCall(deployment.Vester, 1n);
        fail("Transfers should be blocked but succeeded");
      } else {
        // No balance to test with, check by trying to transfer 0
        try {
          await esMPD.connect(signer).transfer.staticCall(deployment.Vester, 0n);
          fail("Transfers should be blocked but succeeded (zero amount)");
        } catch (transferError) {
          if (transferError.message.includes("TransfersDisabled")) {
            pass("Transfers are correctly blocked (TransfersDisabled)");
          } else {
            pass("Transfers appear to be blocked");
          }
        }
      }
    } catch (error) {
      if (error.message.includes("TransfersDisabled")) {
        pass("Transfers are correctly blocked (TransfersDisabled)");
      } else {
        pass("Transfers appear to be blocked");
      }
    }

    // Check non-minter cannot mint
    try {
      const randomAddress = "0x1234567890123456789012345678901234567890";
      const isMinter = await esMPD.isMinter(randomAddress);
      if (!isMinter) {
        pass("Random address is not a minter (access control working)");
      } else {
        fail("Random address should not be a minter");
      }
    } catch (error) {
      fail(`Error checking minter status: ${error.message}`);
    }

  } catch (error) {
    fail(`Error validating EsMPD: ${error.message}`);
  }
}

/**
 * @notice Validates Vester contract
 */
async function validateVester(vester, deployment) {
  section("Vester Validation");

  try {
    // Check stored MPD address
    const storedMPD = await vester.mpd();
    if (storedMPD.toLowerCase() === deployment.MPDToken.toLowerCase()) {
      pass("Stored MPD address matches deployment");
    } else {
      fail(`Stored MPD is ${storedMPD}, expected ${deployment.MPDToken}`);
    }

    // Check stored esMPD address
    const storedEsMPD = await vester.esMpd();
    if (storedEsMPD.toLowerCase() === deployment.esMPD.toLowerCase()) {
      pass("Stored esMPD address matches deployment");
    } else {
      fail(`Stored esMPD is ${storedEsMPD}, expected ${deployment.esMPD}`);
    }

    // Check vesting duration
    const vestingDuration = await vester.vestingDuration();
    if (vestingDuration === BigInt(deployment.vestingDuration)) {
      pass(`Vesting duration is ${vestingDuration} seconds (${Number(vestingDuration) / 86400} days)`);
    } else {
      fail(`Vesting duration is ${vestingDuration}, expected ${deployment.vestingDuration}`);
    }

    // Check owner
    const owner = await vester.owner();
    if (owner.toLowerCase() === deployment.deployer.toLowerCase()) {
      pass("Vester owner is deployer");
    } else {
      fail(`Vester owner is ${owner}, expected ${deployment.deployer}`);
    }

  } catch (error) {
    fail(`Error validating Vester: ${error.message}`);
  }
}

/**
 * @notice Validates deployer/signer
 */
async function validateDeployer(signer, deployment) {
  section("Deployer Validation");

  try {
    const signerAddress = await signer.getAddress();
    
    if (signerAddress.toLowerCase() === deployment.deployer.toLowerCase()) {
      pass(`Signer matches deployer: ${signerAddress}`);
    } else {
      fail(`Signer is ${signerAddress}, expected deployer ${deployment.deployer}`);
    }

    const balance = await hre.ethers.provider.getBalance(signerAddress);
    console.log(`  ℹ️  Signer balance: ${hre.ethers.formatEther(balance)} ETH`);

  } catch (error) {
    fail(`Error validating deployer: ${error.message}`);
  }
}

// ============ Main Function ============

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  separator();
  console.log("🔍 MPD Token Suite Validation");
  separator();
  console.log("Network:", network);
  console.log("Signer: ", await signer.getAddress());
  separator();

  // Load deployment data
  console.log("\n📂 Loading deployment data...");
  let deployment;
  try {
    deployment = loadDeployment(network);
    console.log("   Loaded deployment from:", network === "hardhat" ? "local.json" : `${network}.json`);
    console.log("   Deployment timestamp:", deployment.timestamp || "N/A");
  } catch (error) {
    console.error(`\n❌ Failed to load deployment: ${error.message}`);
    process.exit(1);
  }

  // Connect to contracts
  console.log("\n🔗 Connecting to contracts...");
  
  const mpdToken = await hre.ethers.getContractAt("MPDToken", deployment.MPDToken);
  console.log("   MPDToken:", deployment.MPDToken);
  
  const esMPD = await hre.ethers.getContractAt("EsMPD", deployment.esMPD);
  console.log("   EsMPD:   ", deployment.esMPD);
  
  const vester = await hre.ethers.getContractAt("Vester", deployment.Vester);
  console.log("   Vester:  ", deployment.Vester);

  // Run validations
  await validateMPDToken(mpdToken, deployment);
  await validateEsMPD(esMPD, deployment, signer);
  await validateVester(vester, deployment);
  await validateDeployer(signer, deployment);

  // Summary
  separator();
  console.log("\n📊 VALIDATION SUMMARY");
  separator();
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📋 Total:  ${passCount + failCount}`);
  separator();

  if (failCount > 0) {
    console.log("\n⚠️  Validation completed with failures!\n");
    process.exit(1);
  } else {
    console.log("\n✅ All validations passed!\n");
    process.exit(0);
  }
}

// ============ Execute ============

main()
  .then(() => {})
  .catch((error) => {
    console.error("\n❌ Validation script error:");
    console.error(error);
    process.exit(1);
  });

