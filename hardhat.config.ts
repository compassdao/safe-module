import dotenv from "dotenv"
import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "solidity-coverage"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import "hardhat-abi-exporter"
import { HttpNetworkUserConfig } from "hardhat/types"
import "./scripts/clone-new-safe-module"

// Load environment variables.
dotenv.config()
const { MNEMONIC } = process.env

const sharedNetworkConfig: HttpNetworkUserConfig = {}
if (MNEMONIC) {
  Object.assign(sharedNetworkConfig, {
    accounts: {
      mnemonic: MNEMONIC!,
    },
  })
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.6",
      },
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  networks: {
    mainnet: {
      ...sharedNetworkConfig,
      url: "https://rpc.ankr.com/eth",
    },
    goerli: {
      ...sharedNetworkConfig,
      url: "https://rpc.ankr.com/eth_goerli",
    },
  },
  abiExporter: {
    clear: true,
    flat: true,
  },
}

export default config
