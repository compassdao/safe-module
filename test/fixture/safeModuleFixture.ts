import { ethers } from "hardhat"

export const safeModuleFixture = async (owner?: string) => {
  const safeProxy = await ethers
    .getContractFactory("TestSafeProxy")
    .then((factory) => factory.deploy())

  owner ??= safeProxy.address

  const permissions = await ethers
    .getContractFactory("Permissions")
    .then((factory) => factory.deploy())

  const safeModule = await ethers
    .getContractFactory("SafeModule", {
      libraries: {
        Permissions: permissions.address,
      },
    })
    .then((factory) => factory.deploy(owner!, safeProxy.address))

  const testContract = await ethers
    .getContractFactory("TestContract")
    .then((factory) => factory.deploy())

  return { safeProxy, permissions, safeModule, testContract }
}

export enum Operation {
  None,
  Send,
  DelegateCall,
  Both,
}

export enum ParameterType {
  Static,
  Dynamic,
  Dynamic32,
}

export enum Comparison {
  Eq,
  Gt,
  Lt,
}
