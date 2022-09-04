import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"

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
}

export default config
