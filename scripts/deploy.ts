import { ethers } from "hardhat"
const SAFE_PROXY =
  process.env.SAFE_PROXY || "0x0000000000000000000000000000000000000001"

async function main(owner: string, safeProxy: string) {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying contracts with the account:", deployer.address)
  console.log("Account balance:", (await deployer.getBalance()).toString())

  console.log(`Deployment arguments. owner: ${owner}, safeProxy: ${safeProxy}`)

  console.log("Deploy Permissions library...")
  const permissions = await ethers
    .getContractFactory("Permissions")
    .then((factory) => factory.deploy())

  console.log("Deploy SafeModule...")
  const safeModule = await ethers
    .getContractFactory("SafeModule", {
      libraries: {
        Permissions: permissions.address,
      },
    })
    .then((factory) => factory.deploy(safeProxy, safeProxy))

  await safeModule.deployed()

  console.log(`Deploy safe module completed. safeModule: ${safeModule.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(SAFE_PROXY, SAFE_PROXY).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
