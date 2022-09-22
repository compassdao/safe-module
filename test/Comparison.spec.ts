import { ethers } from "hardhat"
import {
  Comparison,
  Operation,
  padPermitSettledResult,
  ParameterType,
  PermitSettledResult,
  safeModuleFixture,
} from "./fixture/safeModuleFixture"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"

const ROLE_ID = ethers.utils.zeroPad("0x01", 32)

const prepareDeployment = async () => {
  const customOwnerSafeModuleFixture = async () => {
    const [owner] = await ethers.getSigners()
    return safeModuleFixture(owner.address)
  }

  const fixture = await loadFixture(customOwnerSafeModuleFixture)
  const { safeModule, testContract } = fixture
  const [owner, other] = await ethers.getSigners()

  const { data: doNothingData } =
    await testContract.populateTransaction.doNothing()
  await safeModule.connect(owner).assignRole(other.address, ROLE_ID)
  return { ...fixture, owner, other, doNothingData: doNothingData! }
}

describe("Comparison", () => {
  it("revert if input length mismatch", async () => {
    const { safeModule, testContract, owner, permissions, doNothingData } =
      await prepareDeployment()

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, false],
          [ParameterType.Static, ParameterType.Dynamic, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq],
          ["0x", "0x"],
          Operation.Call
        )
    ).to.revertedWithCustomError(permissions, "ArraysDifferentLength")

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, false],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq, Comparison.Eq],
          ["0x", "0x"],
          Operation.Call
        )
    ).to.revertedWithCustomError(permissions, "ArraysDifferentLength")

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, false],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq],
          ["0x", "0x", "0x"],
          Operation.Call
        )
    ).to.revertedWithCustomError(permissions, "ArraysDifferentLength")

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, false],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq],
          [ethers.utils.defaultAbiCoder.encode(["bool"], [false]), "0x"],
          Operation.Call
        )
    ).to.be.not.reverted
  })

  it("enforces comparison for scopeFunction", async () => {
    const { safeModule, testContract, owner, permissions, doNothingData } =
      await prepareDeployment()

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, true],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Gt],
          [ethers.utils.defaultAbiCoder.encode(["bool"], [false]), "0x"],
          Operation.Call
        )
    ).to.be.revertedWithCustomError(permissions, "UnsuitableRelativeComparison")

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, true],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq],
          [ethers.utils.defaultAbiCoder.encode(["bool"], [false]), "0x"],
          Operation.Call
        )
    ).to.be.not.reverted

    // for greater than
    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, true],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Gt, Comparison.Eq],
          [ethers.utils.defaultAbiCoder.encode(["bool"], [false]), "0x"],
          Operation.Call
        )
    ).to.be.not.reverted

    // for less than
    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          [true, true],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Lt, Comparison.Eq],
          [ethers.utils.defaultAbiCoder.encode(["bool"], [false]), "0x"],
          Operation.Call
        )
    ).to.be.not.reverted
  })

  it("passes an eq comparison", async () => {
    const { safeModule, testContract, owner, other } = await prepareDeployment()

    const invoke = async (val: number) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testContract.address,
          0,
          (await testContract.populateTransaction.fnWithSingleParam(val)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("fnWithSingleParam")
    )

    // scope contract then scope function with parameters
    await safeModule.connect(owner).scopeContract(ROLE_ID, testContract.address)
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Eq],
        [ethers.utils.solidityPack(["uint256"], [123])],
        Operation.Call
      )

    await expect(invoke(321))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )
    await expect(invoke(123)).to.be.emit(testContract, "FnWithSingleParam")
  })

  it('"passes an eq comparison for dynamic"', async () => {
    const { safeModule, testContract, owner, other } = await prepareDeployment()

    const invoke = async (a: boolean, s: string) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testContract.address,
          0,
          (await testContract.populateTransaction.fnWithTwoMixedParams(a, s))
            .data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("fnWithTwoMixedParams")
    )

    // scope contract then scope function with parameters
    await safeModule.connect(owner).scopeContract(ROLE_ID, testContract.address)
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [false, true],
        [ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq],
        ["0x", ethers.utils.solidityPack(["string"], ["Some string"])],
        Operation.Call
      )

    await expect(invoke(false, "Some string")).to.be.emit(
      testContract,
      "FnWithTwoMixedParams"
    )
    await expect(invoke(true, "Some string")).to.be.emit(
      testContract,
      "FnWithTwoMixedParams"
    )
    await expect(invoke(false, "Some other string"))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )
  })

  it("passes an eq comparison for dynamic - empty buffer", async () => {
    const { safeModule, testContract, owner, other } = await prepareDeployment()

    const invoke = async (s: string) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testContract.address,
          0,
          (await testContract.populateTransaction.dynamic(s)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("dynamic")
    )

    // scope contract then scope function with parameters
    await safeModule.connect(owner).scopeContract(ROLE_ID, testContract.address)
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Dynamic],
        [Comparison.Eq],
        ["0x"],
        Operation.Call
      )

    await expect(invoke("0x")).to.be.emit(testContract, "Dynamic")
    await expect(invoke("0x12"))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )
  })

  it("passes an eq comparison for dynamic32", async () => {
    const { safeModule, testContract, owner, other } = await prepareDeployment()

    const invoke = async (s: string, extra: any[]) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testContract.address,
          0,
          (await testContract.populateTransaction.dynamicDynamic32(s, extra))
            .data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("dynamicDynamic32")
    )

    // scope contract then scope function with parameters
    await safeModule.connect(owner).scopeContract(ROLE_ID, testContract.address)
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [false, true],
        [ParameterType.Dynamic, ParameterType.Dynamic32],
        [Comparison.Eq, Comparison.Eq],
        ["0x", ethers.utils.solidityPack(["bytes2[]"], [["0x1234", "0xabcd"]])],
        Operation.Call
      )

    await expect(invoke("Doesn't matter", ["0x0234", "0xabcd"]))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )
    await expect(invoke("Doesn't matter", ["0x1234", "0xabcd"])).to.be.emit(
      testContract,
      "DynamicDynamic32"
    )
  })

  it("passes an eq comparison for dynamic32 - empty array", async () => {
    const { safeModule, testContract, owner, other } = await prepareDeployment()

    const invoke = async (extra: any[]) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testContract.address,
          0,
          (await testContract.populateTransaction.dynamic32(extra)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("dynamic32")
    )

    // scope contract then scope function with parameters
    await safeModule.connect(owner).scopeContract(ROLE_ID, testContract.address)
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Dynamic32],
        [Comparison.Eq],
        [[]],
        Operation.Call
      )

    await expect(invoke([])).to.be.emit(testContract, "Dynamic32")
    await expect(invoke(["0xaabbccddeeff0011"]))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )
  })

  it("re-scopes all comparison", async () => {
    const { safeModule, testContract, owner, other } = await prepareDeployment()

    const invoke = async (val: number) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testContract.address,
          0,
          (await testContract.populateTransaction.fnWithSingleParam(val)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("fnWithSingleParam")
    )

    // scope contract then scope parameter with 'eq' comparison
    await safeModule.connect(owner).scopeContract(ROLE_ID, testContract.address)
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Eq],
        [ethers.utils.solidityPack(["uint256"], [213])],
        Operation.Call
      )

    await expect(invoke(321))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )

    await expect(invoke(123))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )

    await expect(invoke(213)).to.be.emit(testContract, "FnWithSingleParam")

    // re-scope to 'gt'
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Gt],
        [ethers.utils.solidityPack(["uint256"], [213])],
        Operation.Call
      )

    await expect(invoke(321)).to.be.emit(testContract, "FnWithSingleParam")
    await expect(invoke(123))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )

    await expect(invoke(213))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )

    // re-scope to 'lt'
    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Lt],
        [ethers.utils.solidityPack(["uint256"], [213])],
        Operation.Call
      )

    await expect(invoke(321))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )

    await expect(invoke(123)).to.be.emit(testContract, "FnWithSingleParam")
    await expect(invoke(213))
      .to.be.revertedWithCustomError(safeModule, "PermitReject")
      .withArgs(
        padPermitSettledResult(PermitSettledResult.ParametersScopeRejected)
      )
  })
})
