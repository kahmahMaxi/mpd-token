// SPDX-License-Identifier: MIT
/**
 * @title MPD Token Deployment Script
 * @notice Deploys MPDToken and EsMPD contracts
 * @dev Run with: npx hardhat run scripts/deploy.js --network <network>
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("=".repeat(60));
  console.log("MPD Token Deployment");
  console.log("=".repeat(60));
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Network:", hre.network.name);
  console.log("=".repeat(60));

  // Deploy MPDToken
  console.log("\n[1/2] Deploying MPDToken...");
  const MPDToken = await hre.ethers.getContractFactory("MPDToken");
  const mpdToken = await MPDToken.deploy(deployer.address);
  await mpdToken.waitForDeployment();
  const mpdTokenAddress = await mpdToken.getAddress();
  console.log("✅ MPDToken deployed to:", mpdTokenAddress);

  // Deploy EsMPD
  console.log("\n[2/2] Deploying EsMPD...");
  const EsMPD = await hre.ethers.getContractFactory("EsMPD");
  const esMPD = await EsMPD.deploy(deployer.address);
  await esMPD.waitForDeployment();
  const esMPDAddress = await esMPD.getAddress();
  console.log("✅ EsMPD deployed to:", esMPDAddress);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Deployment Summary");
  console.log("=".repeat(60));
  console.log("MPDToken:", mpdTokenAddress);
  console.log("EsMPD:   ", esMPDAddress);
  console.log("Owner:   ", deployer.address);
  console.log("=".repeat(60));

  // Verification instructions
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n📋 To verify contracts on Etherscan:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${mpdTokenAddress} ${deployer.address}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${esMPDAddress} ${deployer.address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

