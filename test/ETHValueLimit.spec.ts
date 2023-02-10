import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import {
  DEFAULT_ROLE_NAME,
  Operation,
  safeModuleFixture,
} from "./fixture/safeModuleFixture"

const prepareFixture = async () => {
  const fixture = await loadFixture(safeModuleFixture)
  const { safeModule, testContract, owner, other, safeProxy } = fixture

  await safeModule
    .connect(owner)
    .assignRoles(other.address, [DEFAULT_ROLE_NAME])

  await owner.sendTransaction({
    to: safeProxy.address,
    value: "1000000000000000000",
    gasLimit: 210000,
  })

  const { data: receiveEthAndDoNothingData } =
    await testContract.populateTransaction.receiveEthAndDoNothing()

  return { ...fixture, receiveEthAndDoNothingData: receiveEthAndDoNothingData! }
}

describe("ETH Value Limit", () => {
  it("no value to use", async () => {
    const {
      safeModule,
      testContract,
      owner,
      other,
      receiveEthAndDoNothingData,
    } = await prepareFixture()

    const invoke = async (ethVal: number) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testContract.address,
          ethVal,
          receiveEthAndDoNothingData,
          Operation.Call
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
        receiveEthAndDoNothingData,
        0,
        [],
        [],
        [],
        [],
        Operation.Call
      )

    await expect(invoke(1)).to.be.revertedWith(
      "Permissions: eth value isn't less than or equal to limit"
    )

    await expect(invoke(0)).to.be.emit(testContract, "ReceiveEthAndDoNothing")
  })

  it("can use up to 10 wei", async () => {
    const {
      safeModule,
      testContract,
      owner,
      other,
      receiveEthAndDoNothingData,
    } = await prepareFixture()

    const invoke = async (ethVal: number) =>
      safeModule
        .connect(other)
        .execTransactionFromModule(
          DEFAULT_ROLE_NAME,
          testContract.address,
          ethVal,
          receiveEthAndDoNothingData,
          Operation.Call
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
        receiveEthAndDoNothingData,
        10,
        [],
        [],
        [],
        [],
        Operation.Call
      )

    await expect(invoke(1))
      .to.be.emit(testContract, "ReceiveEthAndDoNothing")
      .withArgs(1)
    await expect(invoke(0))
      .to.be.emit(testContract, "ReceiveEthAndDoNothing")
      .withArgs(0)
    await expect(invoke(10))
      .to.be.emit(testContract, "ReceiveEthAndDoNothing")
      .withArgs(10)
    await expect(invoke(11)).to.be.revertedWith(
      "Permissions: eth value isn't less than or equal to limit"
    )
  })
})
