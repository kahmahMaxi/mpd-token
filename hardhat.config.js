require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 * 
 * Environment Variables (set in .env file):
 * - PRIVATE_KEY: Deployer wallet private key (without 0x prefix)
 * - ARBITRUM_SEPOLIA_RPC_URL: RPC endpoint for Arbitrum Sepolia testnet
 * - BASE_SEPOLIA_RPC_URL: RPC endpoint for Base Sepolia testnet
 * - ETHERSCAN_API_KEY: API key for contract verification
 * - REPORT_GAS: Set to "true" to enable gas reporting
 */

// Helper to get accounts array - only include if private key is valid (64 hex chars)
const getAccounts = () => {
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey && privateKey.length === 64) {
    return [privateKey];
  }
  if (privateKey && privateKey.startsWith("0x") && privateKey.length === 66) {
    return [privateKey];
  }
  return [];
};

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: getAccounts(),
      chainId: 421614,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: getAccounts(),
      chainId: 84532,
    },
    // Additional testnets - uncomment and configure as needed
    // sepolia: {
    //   url: process.env.SEPOLIA_RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    //   chainId: 11155111,
    // },
    // goerli: {
    //   url: process.env.GOERLI_RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    //   chainId: 5,
    // },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
