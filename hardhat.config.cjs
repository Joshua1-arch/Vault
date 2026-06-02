require("@nomicfoundation/hardhat-toolbox");
const dotenv = require("dotenv");

dotenv.config();

// Default placeholder private key for safety when running compile or local tasks without a .env set up
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

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
  networks: {
    hardhat: {
      // Local development network
    },
    aeneid: {
      url: "https://aeneid.storyrpc.io",
      chainId: 1315,
      accounts: [PRIVATE_KEY],
    },
  },
};
