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

const AddressOne = "0x0000000000000000000000000000000000000001"

const prepareFixture = async () => {
  const fixture = await loadFixture(safeModuleFixture)
  const { safeModule, owner, other } = fixture

  await safeModule
    .connect(owner)
    .assignRoles(other.address, [DEFAULT_ROLE_NAME])

  const testPluckParam = await ethers
    .getContractFactory("TestPluckParam")
    .then((factory) => factory.deploy())

  await safeModule
    .connect(owner)
    .scopeContract(DEFAULT_ROLE_NAME, testPluckParam.address)

  return { ...fixture, testPluckParam }
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
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true],
        [ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["bytes4"], ["0x12345678"]),
          encodeDynamic(["string"], ["Hello World!"]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "StaticDynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).revertedWith("Permissions: input value isn't equal to target value")
  })

  it("static, dynamic, dynamic32 - (address,bytes,uint32[])", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamicDynamic32")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true, true],
        [ParameterType.Static, ParameterType.Dynamic, ParameterType.Dynamic32],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["address"], [AddressOne]),
          encodeDynamic(["bytes"], ["0xabcd"]),
          encodeDynamic32(["uint32[]"], [[1, 2, 3]]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "StaticDynamicDynamic32")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).rejectedWith("Permissions: input value isn't equal to target value")
  })

  it("static, dynamic32, dynamic - (uint32,bytes4[],string)", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic32Dynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true, true],
        [ParameterType.Static, ParameterType.Dynamic32, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["uint32"], [123]),
          encodeDynamic32(["bytes4[]"], [["0xabcdef12"]]),
          encodeDynamic(["string"], ["Hello World!"]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "StaticDynamic32Dynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).to.be.revertedWith("Permissions: input value isn't equal to target value")
  })

  it("dynamic, static, dynamic32 - (bytes,bool,bytes2[])", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamicStaticDynamic32")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true, true],
        [ParameterType.Dynamic, ParameterType.Static, ParameterType.Dynamic32],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic(["bytes"], ["0x12ab45"]),
          encodeStatic(["bool"], [false]),
          encodeDynamic32(["bytes2[]"], [["0x1122", "0x3344"]]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "DynamicStaticDynamic32")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).to.be.revertedWith("Permissions: input value isn't equal to target value")
  })

  it("dynamic, dynamic32, static - (string,uint32[],uint256)", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamicDynamic32Static")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true, true],
        [ParameterType.Dynamic, ParameterType.Dynamic32, ParameterType.Static],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic(["string"], ["Hello World!"]),
          encodeDynamic32(["uint32[]"], [[1975, 2000, 2025]]),
          encodeStatic(["uint256"], [123456789]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "DynamicDynamic32Static")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).to.revertedWith("Permissions: input value isn't equal to target value")
  })

  it("dynamic32, static, dynamic - (address[],bytes2,bytes)", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamic32StaticDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true, true],
        [ParameterType.Dynamic32, ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic32(["address[]"], [[AddressOne, AddressOne]]),
          encodeStatic(["bytes2"], ["0xaabb"]),
          encodeDynamic(["bytes"], ["0x0123456789abcdef"]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "Dynamic32StaticDynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).to.be.revertedWith("Permissions: input value isn't equal to target value")
  })

  it("dynamic32, dynamic, static - (bytes2[],string,uint32)", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("dynamic32DynamicStatic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true, true],
        [ParameterType.Dynamic32, ParameterType.Dynamic, ParameterType.Static],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeDynamic32(["bytes2[]"], [["0xaabb", "0xccdd", "0x1122"]]),
          encodeDynamic(["string"], ["Hello World!"]),
          encodeStatic(["uint32"], [8976]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "Dynamic32DynamicStatic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).to.revertedWith("Permissions: input value isn't equal to target value")
  })

  it("warning! don't try this at home", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("unsupportedFixedSizeAndDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true, true, true],
        [ParameterType.Static, ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq, Comparison.Eq],
        [
          encodeStatic(["bool"], [false]),
          encodeStatic(["bool"], [false]),
          encodeDynamic(["string"], ["Hello World!"]),
        ],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.emit(testPluckParam, "UnsupportedFixedSizeAndDynamic")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad!,
          Operation.Call
        )
    ).to.revertedWith("Permissions: input value isn't equal to target value")
  })

  it("static - fails if calldata is too short", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticFn")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [true],
        [ParameterType.Static],
        [Comparison.Eq],
        [encodeStatic(["bytes4"], ["0x12345678"])],
        Operation.Call
      )

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          funcSig,
          Operation.Call
        )
    ).to.be.revertedWith("Permissions: calldata out of bounds for static type")

    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          `${funcSig}aabbccdd`,
          Operation.Call
        )
    ).to.be.revertedWith("Permissions: calldata out of bounds for static type")
  })

  it("dynamic - fails if calldata too short", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic")
    )
    const funcSigOther = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticFn")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [false, true],
        [ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq],
        ["0x", encodeDynamic(["string"], ["Hello World!"])],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataShort,
          Operation.Call
        )
    ).to.be.revertedWith(
      "Permissions: calldata out of bounds for dynamic type at the first"
    )

    // just the selector
    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          funcSig,
          Operation.Call
        )
    ).to.be.revertedWith(
      "Permissions: calldata out of bounds for dynamic type at the first"
    )

    // ok
    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.be.emit(testPluckParam, "StaticDynamic")
  })

  it("dynamic - fails if payload is missing", async () => {
    const { safeModule, testPluckParam, owner, other } = await prepareFixture()

    const funcSig = testPluckParam.interface.getSighash(
      testPluckParam.interface.getFunction("staticDynamic")
    )

    await safeModule
      .connect(owner)
      .scopeFunction(
        DEFAULT_ROLE_NAME,
        testPluckParam.address,
        funcSig,
        0,
        [false, true],
        [ParameterType.Static, ParameterType.Dynamic],
        [Comparison.Eq, Comparison.Eq],
        ["0x", encodeDynamic(["string"], ["Hello World!"])],
        Operation.Call
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
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataBad,
          Operation.Call
        )
    ).to.be.revertedWith(
      "Permissions: calldata out of bounds for dynamic type at the end"
    )

    // ok
    await expect(
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testPluckParam.address,
          0,
          dataGood!,
          Operation.Call
        )
    ).to.be.emit(testPluckParam, "StaticDynamic")
  })
})
