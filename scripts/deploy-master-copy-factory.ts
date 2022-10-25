import { ethers } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying contracts with the account:", deployer.address)
  console.log("Account balance:", (await deployer.getBalance()).toString())

  const masterCopyFactory = await ethers
    .getContractFactory("MasterCopyFactory")
    .then((factory) => factory.deploy())

  console.log("Deploy MasterCopyFactory...")
  await masterCopyFactory.deployed()

  console.log(
    `Deploy completed. masterCopyFactory: ${masterCopyFactory.address}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
