import { ethers } from "hardhat"
import {
  Comparison,
  Operation,
  ParameterType,
  DEFAULT_ROLE_NAME,
  safeModuleFixture,
} from "./fixture/safeModuleFixture"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"

const prepareFixture = async () => {
  const fixture = await loadFixture(safeModuleFixture)
  const { safeModule, testContract, owner, other } = fixture

  await safeModule
    .connect(owner)
    .assignRoles(other.address, [DEFAULT_ROLE_NAME])

  const { data: doNothingData } =
    await testContract.populateTransaction.doNothing()

  return { ...fixture, doNothingData: doNothingData! }
}

describe("Comparison", () => {
  it("revert if input length mismatch", async () => {
    const { safeModule, testContract, owner, doNothingData } =
      await prepareFixture()

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          [true, false],
          [ParameterType.Static, ParameterType.Dynamic, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq],
          ["0x", "0x"],
          Operation.Call
        )
    ).to.revertedWith("Permissions: length of arrays should be the same")

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          [true, false],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq, Comparison.Eq],
          ["0x", "0x"],
          Operation.Call
        )
    ).to.revertedWith("Permissions: length of arrays should be the same")

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          [true, false],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Eq],
          ["0x", "0x", "0x"],
          Operation.Call
        )
    ).to.revertedWith("Permissions: length of arrays should be the same")

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
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
    const { safeModule, testContract, owner, doNothingData } =
      await prepareFixture()

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          [true, true],
          [ParameterType.Static, ParameterType.Dynamic],
          [Comparison.Eq, Comparison.Gt],
          [ethers.utils.defaultAbiCoder.encode(["bool"], [false]), "0x"],
          Operation.Call
        )
    ).to.revertedWith(
      "Permissions: only supports eq comparison for non-static type"
    )

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
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
          DEFAULT_ROLE_NAME,
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
          DEFAULT_ROLE_NAME,
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
    const { safeModule, testContract, owner, other } = await prepareFixture()

    const invoke = async (val: number) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testContract.address,
          0,
          (await testContract.populateTransaction.fnWithSingleParam(val)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("fnWithSingleParam")
    )

    // scope contract then scope function with parameters
    await safeModule
      .connect(owner)
      .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Eq],
        [ethers.utils.solidityPack(["uint256"], [123])],
        Operation.Call
      )

    await expect(invoke(321)).to.be.revertedWith(
      "Permissions: input value isn't equal to target value"
    )

    await expect(invoke(123)).to.be.emit(testContract, "FnWithSingleParam")
  })

  it("passes an eq comparison for dynamic", async () => {
    const { safeModule, testContract, owner, other } = await prepareFixture()

    const invoke = async (a: boolean, s: string) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
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
    await safeModule
      .connect(owner)
      .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
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

    await expect(invoke(false, "Some other string")).to.be.revertedWith(
      "Permissions: input value isn't equal to target value"
    )
  })

  it("passes an eq comparison for dynamic - empty buffer", async () => {
    const { safeModule, testContract, owner, other } = await prepareFixture()

    const invoke = async (s: string) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testContract.address,
          0,
          (await testContract.populateTransaction.dynamic(s)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("dynamic")
    )

    // scope contract then scope function with parameters
    await safeModule
      .connect(owner)
      .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Dynamic],
        [Comparison.Eq],
        ["0x"],
        Operation.Call
      )

    await expect(invoke("0x")).to.be.emit(testContract, "Dynamic")
    await expect(invoke("0x12")).to.be.revertedWith(
      "Permissions: input value isn't equal to target value"
    )
  })

  it("passes an eq comparison for dynamic32", async () => {
    const { safeModule, testContract, owner, other } = await prepareFixture()

    const invoke = async (s: string, extra: any[]) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
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
    await safeModule
      .connect(owner)
      .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testContract.address,
        funcSig,
        [false, true],
        [ParameterType.Dynamic, ParameterType.Dynamic32],
        [Comparison.Eq, Comparison.Eq],
        ["0x", ethers.utils.solidityPack(["bytes2[]"], [["0x1234", "0xabcd"]])],
        Operation.Call
      )

    await expect(
      invoke("Doesn't matter", ["0x0234", "0xabcd"])
    ).to.be.revertedWith("Permissions: input value isn't equal to target value")

    await expect(invoke("Doesn't matter", ["0x1234", "0xabcd"])).to.be.emit(
      testContract,
      "DynamicDynamic32"
    )
  })

  it("passes an eq comparison for dynamic32 - empty array", async () => {
    const { safeModule, testContract, owner, other } = await prepareFixture()

    const invoke = async (extra: any[]) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testContract.address,
          0,
          (await testContract.populateTransaction.dynamic32(extra)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("dynamic32")
    )

    // scope contract then scope function with parameters
    await safeModule
      .connect(owner)
      .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Dynamic32],
        [Comparison.Eq],
        [[]],
        Operation.Call
      )

    await expect(invoke([])).to.be.emit(testContract, "Dynamic32")
    await expect(invoke(["0xaabbccddeeff0011"])).to.be.revertedWith(
      "Permissions: input value isn't equal to target value"
    )
  })

  it("re-scopes all comparison", async () => {
    const { safeModule, testContract, owner, other } = await prepareFixture()

    const invoke = async (val: number) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testContract.address,
          0,
          (await testContract.populateTransaction.fnWithSingleParam(val)).data!,
          Operation.Call
        )

    const funcSig = testContract.interface.getSighash(
      testContract.interface.getFunction("fnWithSingleParam")
    )

    // scope contract then scope parameter with 'eq' comparison
    await safeModule
      .connect(owner)
      .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Eq],
        [ethers.utils.solidityPack(["uint256"], [213])],
        Operation.Call
      )

    await expect(invoke(321)).to.be.revertedWith(
      "Permissions: input value isn't equal to target value"
    )

    await expect(invoke(123)).to.be.revertedWith(
      "Permissions: input value isn't equal to target value"
    )

    await expect(invoke(213)).to.be.emit(testContract, "FnWithSingleParam")

    // re-scope to 'gt'
    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Gt],
        [ethers.utils.solidityPack(["uint256"], [213])],
        Operation.Call
      )

    await expect(invoke(321)).to.be.emit(testContract, "FnWithSingleParam")
    await expect(invoke(123)).to.be.revertedWith(
      "Permissions: input value isn't greater than target value"
    )

    await expect(invoke(213)).to.be.revertedWith(
      "Permissions: input value isn't greater than target value"
    )

    // re-scope to 'lt'
    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testContract.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Lt],
        [ethers.utils.solidityPack(["uint256"], [213])],
        Operation.Call
      )

    await expect(invoke(321)).to.be.revertedWith(
      "Permissions: input value isn't less than target value"
    )

    await expect(invoke(123)).to.be.emit(testContract, "FnWithSingleParam")
    await expect(invoke(213)).to.be.revertedWith(
      "Permissions: input value isn't less than target value"
    )
  })

  it("disallow invalid parameter type", async () => {
    const { safeModule, testContract, doNothingData, owner } =
      await prepareFixture()

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          [true],
          [3],
          [Comparison.Eq],
          ["0x"],
          Operation.Call
        )
    ).to.be.rejectedWith("function was called with incorrect parameters")
  })

  it("disallow invalid operation", async () => {
    const { safeModule, testContract, doNothingData, owner } =
      await prepareFixture()

    await expect(
      safeModule
        .connect(owner)
        .scopeFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          [true],
          [ParameterType.Static],
          [3],
          ["0x"],
          Operation.Call
        )
    ).to.be.rejectedWith("function was called with incorrect parameters")
  })
})
