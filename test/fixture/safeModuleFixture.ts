import { ethers } from "hardhat"

export const safeModuleFixture = async (myAddress?: string) => {
  const [owner, other] = await ethers.getSigners()

  const safeProxy = await ethers
    .getContractFactory("TestSafeProxy")
    .then((factory) => factory.deploy())

  const permissions = await ethers
    .getContractFactory("Permissions")
    .then((factory) => factory.deploy())

  const safeModule = await ethers
    .getContractFactory("SafeModule", {
      libraries: {
        Permissions: permissions.address,
      },
    })
    .then((factory) =>
      factory.deploy(myAddress ?? owner.address, safeProxy.address)
    )

  const testContract = await ethers
    .getContractFactory("TestContract")
    .then((factory) => factory.deploy())

  return { safeProxy, permissions, safeModule, testContract, owner, other }
}

export enum Operation {
  None,
  Call,
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
  Gte,
  Lte,
}

export enum PermitSettledResult {
  Unknown,
  Fulfilled,
  ContractScopeRejected,
  FunctionScopeRejected,
  ParametersScopeRejected,
  OperationRejected,
}

export const padPermitSettledResult = (...results: PermitSettledResult[]) => {
  return [...results, ...new Array(16).fill(PermitSettledResult.Unknown)].slice(
    0,
    16
  )
}

export const role = (id: number) =>
  ethers.utils.hexlify(ethers.utils.zeroPad(id as any, 32))

export const DEFAULT_ROLE_NAME = role(1)
