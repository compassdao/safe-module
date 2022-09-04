import { ethers } from "hardhat"

export const deploySafeModuleForTest = async (
  safeProxy = "0x0000000000000000000000000000000000000001"
) => {
  const permissions = await ethers
    .getContractFactory("Permissions")
    .then((factory) => factory.deploy())

  return ethers
    .getContractFactory("SafeModule", {
      libraries: {
        Permissions: permissions.address,
      },
    })
    .then((factory) => factory.deploy(safeProxy))
}
