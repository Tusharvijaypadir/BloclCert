require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Only include accounts if PRIVATE_KEY is a valid 64-char hex string (32 bytes)
const rawKey = process.env.PRIVATE_KEY || "";
const isValidKey = /^[0-9a-fA-F]{64}$/.test(rawKey);
const accounts = isValidKey ? [`0x${rawKey}`] : [];

/** @type import('hardhat/config').HardhatUserConfig */
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
    hardhat: {},
    amoy: {
      url: process.env.ALCHEMY_RPC_URL || "",
      accounts,
      chainId: 80002,
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
};
