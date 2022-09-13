import { ethers } from "hardhat"
import {
  Comparison,
  Operation,
  ParameterType,
  safeModuleFixture,
} from "./fixture/safeModuleFixture"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"

const AddressOne = "0x0000000000000000000000000000000000000001"
const ROLE_ID = ethers.utils.zeroPad("0x01", 32)

const prepareDeployment = async () => {
  const customOwnerSafeModuleFixture = async () => {
    const [owner] = await ethers.getSigners()
    return safeModuleFixture(owner.address)
  }

  const fixture = await loadFixture(customOwnerSafeModuleFixture)
  const { safeModule } = fixture
  const [owner, other] = await ethers.getSigners()

  const testPluckParam = await ethers
    .getContractFactory("TestPluckParam")
    .then((factory) => factory.deploy())
  await safeModule.connect(owner).assignRole(other.address, ROLE_ID)
  await safeModule.connect(owner).scopeContract(ROLE_ID, testPluckParam.address)

  return { ...fixture, owner, other, testPluckParam }
}

const encodeStatic = (types: any[], values: any[]) => {
  return ethers.utils.defaultAbiCoder.encode(types, values)
}

const encodeDynamic = (types: any[], values: any[]) => {
  return ethers.utils.solidityPack(types, values)
}

const encodeDynamic32 = (types: any[], values: any[]) => {
  return ethers.utils.solidityPack(types, values)
}

describe("PluckParam - Decoding", () => {
  it("static, dynamic - (bytes4, string)", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true],
        [ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["bytes4"], ["0x12345678"]),
          encodeDynamic(["string"], ["Hello World!"]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.staticDynamic(
        "0x12345678",
        "Hello World!"
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.staticDynamic(
        "0x12345678",
        "Good Morning!"
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "StaticDynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("static, dynamic, dynamic32 - (address,bytes,uint32[])", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamicDynamic32")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true, true],
        [ParameterType.Static, ParameterType.Dynamic, ParameterType.Dynamic32],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["address"], [AddressOne]),
          encodeDynamic(["bytes"], ["0xabcd"]),
          encodeDynamic32(["uint32[]"], [[1, 2, 3]]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.staticDynamicDynamic32(
        AddressOne,
        "0xabcd",
        [1, 2, 3]
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.staticDynamicDynamic32(
        AddressOne,
        "0xabcd",
        [1, 2, 4]
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "StaticDynamicDynamic32")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("static, dynamic32, dynamic - (uint32,bytes4[],string)", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic32Dynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true, true],
        [ParameterType.Static, ParameterType.Dynamic32, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["uint32"], [123]),
          encodeDynamic32(["bytes4[]"], [["0xabcdef12"]]),
          encodeDynamic(["string"], ["Hello World!"]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.staticDynamic32Dynamic(
        [123],
        ["0xabcdef12"],
        "Hello World!"
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.staticDynamic32Dynamic(
        [123],
        ["0xabcdef12"],
        "Hello World?"
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "StaticDynamic32Dynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("dynamic, static, dynamic32 - (bytes,bool,bytes2[])", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamicStaticDynamic32")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true, true],
        [ParameterType.Dynamic, ParameterType.Static, ParameterType.Dynamic32],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic(["bytes"], ["0x12ab45"]),
          encodeStatic(["bool"], [false]),
          encodeDynamic32(["bytes2[]"], [["0x1122", "0x3344"]]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.dynamicStaticDynamic32(
        "0x12ab45",
        false,
        ["0x1122", "0x3344"]
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.dynamicStaticDynamic32(
        "0x12ab45",
        false,
        ["0x1122", "0x3344", "0x5566"]
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "DynamicStaticDynamic32")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("dynamic, dynamic32, static - (string,uint32[],uint256)", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamicDynamic32Static")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true, true],
        [ParameterType.Dynamic, ParameterType.Dynamic32, ParameterType.Static],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic(["string"], ["Hello World!"]),
          encodeDynamic32(["uint32[]"], [[1975, 2000, 2025]]),
          encodeStatic(["uint256"], [123456789]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.dynamicDynamic32Static(
        "Hello World!",
        [1975, 2000, 2025],
        123456789
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.dynamicDynamic32Static(
        "Hello World!",
        [1975, 2000],
        123456789
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "DynamicDynamic32Static")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("dynamic32, static, dynamic - (address[],bytes2,bytes)", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamic32StaticDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true, true],
        [ParameterType.Dynamic32, ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic32(["address[]"], [[AddressOne, AddressOne]]),
          encodeStatic(["bytes2"], ["0xaabb"]),
          encodeDynamic(["bytes"], ["0x0123456789abcdef"]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.dynamic32StaticDynamic(
        [AddressOne, AddressOne],
        "0xaabb",
        "0x0123456789abcdef"
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.dynamic32StaticDynamic(
        [AddressOne, AddressOne],
        "0xaabb",
        "0x0123456789abcdef0123456789abcdef"
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "Dynamic32StaticDynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("dynamic32, dynamic, static - (bytes2[],string,uint32)", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamic32DynamicStatic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true, true],
        [ParameterType.Dynamic32, ParameterType.Dynamic, ParameterType.Static],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic32(["bytes2[]"], [["0xaabb", "0xccdd", "0x1122"]]),
          encodeDynamic(["string"], ["Hello World!"]),
          encodeStatic(["uint32"], [8976]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.dynamic32DynamicStatic(
        ["0xaabb", "0xccdd", "0x1122"],
        "Hello World!",
        8976
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.dynamic32DynamicStatic(
        ["0xaabb", "0xccdd", "0x3344"],
        "Hello World!",
        8976
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "Dynamic32DynamicStatic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("warning! don't try this at home", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("unsupportedFixedSizeAndDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true, true, true],
        [ParameterType.Static, ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["bool"], [false]),
          encodeStatic(["bool"], [false]),
          encodeDynamic(["string"], ["Hello World!"]),
        ],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.unsupportedFixedSizeAndDynamic(
        [false, false],
        "Hello World!"
      )

    const { data: dataBad } =
      await testPluckParam.populateTransaction.unsupportedFixedSizeAndDynamic(
        [true, false],
        "Hello World!"
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.emit(testPluckParam, "UnsupportedFixedSizeAndDynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "ParameterNotEqualToExpected")
  })

  it("static - fails if calldata is too short", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticFn")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [true],
        [ParameterType.Static],
        [Comparison.Eq],
        [encodeStatic(["bytes4"], ["0x12345678"])],
        Operation.Send
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          funcSig,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "CalldataOutOfBounds")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          `${funcSig}aabbccdd`,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "CalldataOutOfBounds")
  })

  it("dynamic - fails if calldata too short", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic")
    )
    const funcSigOther = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticFn")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [false, true],
        [ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq],
        ["0x", encodeDynamic(["string"], ["Hello World!"])],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.staticDynamic(
        "0x12345678",
        "Hello World!"
      )

    const dataShort = (
      (await testPluckParam.populateTransaction.staticFn("0x12345678"))
        .data as string
    ).replace(funcSigOther.slice(2), funcSig.slice(2))

    // shortned call
    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataShort,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "CalldataOutOfBounds")

    // just the selector
    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          funcSig,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "CalldataOutOfBounds")

    // ok
    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.be.emit(testPluckParam, "StaticDynamic")
  })

  it("dynamic - fails if payload is missing", async () => {
    const { safeModule, testPluckParam, owner, other, permissions } =
      await prepareDeployment()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        ROLE_ID,
        testPluckParam.address,
        funcSig,
        [false, true],
        [ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq],
        ["0x", encodeDynamic(["string"], ["Hello World!"])],
        Operation.Send
      )

    const { data: dataGood } =
      await testPluckParam.populateTransaction.staticDynamic(
        "0x12345678",
        "Hello World!"
      )

    // 0x737c0619 -> staticDynamic selector
    const dataBad = `\
0x737c0619\
0000000000000000000000000000000000000000000000000000000012345678\
0000000000000000000000000000000000000000000000000000000000300001`

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataBad,
          Operation.Send
        )
    ).to.be.revertedWithCustomError(permissions, "CalldataOutOfBounds")

    // ok
    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Send
        )
    ).to.be.emit(testPluckParam, "StaticDynamic")
  })
})