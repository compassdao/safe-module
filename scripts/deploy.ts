import { ethers } from "hardhat"
const SAFE_PROXY = "0x0000000000000000000000000000000000000001"

async function main(safeProxy: string) {
  const permissions = await ethers
    .getContractFactory("Permissions")
    .then((factory) => factory.deploy())

  const safeModule = await ethers
    .getContractFactory("SafeModule", {
      libraries: {
        Permissions: permissions.address,
      },
    })
    .then((factory) => factory.deploy(safeProxy))

  await safeModule.deployed()

  console.log(
    `deploy safe module. safeProxy: ${safeProxy}, module: ${safeModule.address}`
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(SAFE_PROXY).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
