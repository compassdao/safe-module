import { ethers } from "hardhat"

async function main(owner: string, safeProxy: string) {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying contracts with the account:", deployer.address)
  console.log(
    "Account balance: ",
    await deployer.getBalance().then(ethers.utils.formatEther)
  )
  console.log("Account nonce: ", await deployer.getTransactionCount())

  console.log(`Deployment arguments. owner: ${owner}, safeProxy: ${safeProxy}`)

  const permissions = await ethers
    .getContractFactory("Permissions")
    .then((factory) => factory.connect(deployer).deploy())

  console.log(
    `Deploy Permissions library(${permissions.deployTransaction.hash})...`
  )
  console.log("Permissions address: ", permissions.address)
  await permissions.deployed()

  const safeModule = await ethers
    .getContractFactory("SafeModule", {
      libraries: {
        Permissions: permissions.address,
      },
    })
    .then((factory) => factory.connect(deployer).deploy(owner, safeProxy))

  console.log(`Deploy SafeModule(${safeModule.deployTransaction.hash})...`)
  await safeModule.deployed()

  console.log(`Deploy safe module completed. safeModule: ${safeModule.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(
  process.env.MODULE_OWNER || process.env.SAFE_PROXY!,
  process.env.SAFE_PROXY!
).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
