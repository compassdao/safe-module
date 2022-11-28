import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import {
  Operation,
  padPermitSettledResult,
  PermitSettledResult,
  DEFAULT_ROLE_NAME,
  safeModuleFixture,
} from "./fixture/safeModuleFixture"
import { ethers } from "hardhat"
import { expect } from "chai"

const prepareFixture = async () => {
  const fixture = await loadFixture(safeModuleFixture)
  const { testContract, safeModule, owner, other } = fixture

  const { data: doNothingData } =
    await testContract.populateTransaction.doNothing()

  await safeModule
    .connect(owner)
    .assignRoles(other.address, [DEFAULT_ROLE_NAME])

  return { ...fixture, doNothingData: doNothingData! }
}

const newTestContract = () =>
  ethers.getContractFactory("TestContract").then((factory) => factory.deploy())

describe("Permissions", () => {
  describe("Mix", () => {
    it("should revert only assign role without contract config on role", async () => {
      const { safeModule, testContract, doNothingData, other } =
        await prepareFixture()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: contract not allowed")
    })

    it("role not found", async () => {
      const { safeModule, testContract, doNothingData, owner } =
        await prepareFixture()

      await expect(
        safeModule
          .connect(owner)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("SafeModule: sender doesn't have this role")
    })

    it("function signature too short", async () => {
      const { safeModule, testContract, owner, other } = await prepareFixture()

      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            "0x000000",
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: function signature too short")
    })

    it("call contract with confused operation", async () => {
      const { safeModule, testContract, doNothingData, other } =
        await prepareFixture()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.None
          )
      ).to.be.revertedWith("SafeModule: only support call or delegatecall")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Both
          )
      ).to.be.revertedWith("SafeModule: only support call or delegatecall")
    })
  })

  describe("Contract", () => {
    it("allows and then disallows a contract", async () => {
      const {
        safeModule,

        testContract,
        doNothingData,
        owner,
        other,
      } = await prepareFixture()

      // allow to send
      await safeModule
        .connect(owner)
        .allowContract(DEFAULT_ROLE_NAME, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await safeModule
        .connect(owner)
        .revokeContract(DEFAULT_ROLE_NAME, testContract.address)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: contract not allowed")
    })

    it("allow contract with different operation", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()

      // allow nothing
      await safeModule
        .connect(owner)
        .allowContract(DEFAULT_ROLE_NAME, testContract.address, Operation.None)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.rejectedWith("Permissions: opearion not config")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.revertedWith("Permissions: opearion not config")

      // allow to send
      await safeModule
        .connect(owner)
        .allowContract(DEFAULT_ROLE_NAME, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.rejectedWith("Permissions: require call operation")

      // allow to delegateCall
      await safeModule
        .connect(owner)
        .allowContract(
          DEFAULT_ROLE_NAME,
          testContract.address,
          Operation.DelegateCall
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.rejectedWith("Permissions: require delegatecall operation")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.not.reverted // event has bound to delegateCallee

      // allow both
      await safeModule
        .connect(owner)
        .allowContract(DEFAULT_ROLE_NAME, testContract.address, Operation.Both)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.not.reverted // event has bound to delegateCallee
    })

    it("allowing a contract but not allow other contract", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()

      await safeModule
        .connect(owner)
        .allowContract(DEFAULT_ROLE_NAME, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      const anotherTestContract = await newTestContract()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            anotherTestContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: contract not allowed")
    })
  })

  describe("Function", () => {
    it("allows and then disallows a function", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()

      // scope contract and allow function
      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      const { data: doEvenLessData } = await testContract.doEvenLess()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.revertedWith("Permissions: function not allowed")

      // revoke function
      await safeModule
        .connect(owner)
        .revokeFunction(DEFAULT_ROLE_NAME, testContract.address, doNothingData)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: function not allowed")

      // revoke contract
      await safeModule
        .connect(owner)
        .revokeContract(DEFAULT_ROLE_NAME, testContract.address)
      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.rejectedWith("Permissions: contract not allowed")
    })

    it("allowing function on a contract does not allow same function on diff contract", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()

      // scope contract and allow function
      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, testContract.address)

      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      const anotherTestContract = await newTestContract()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            anotherTestContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: contract not allowed")

      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, anotherTestContract.address)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            anotherTestContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: function not allowed")
    })

    it("allowing a function tightens a previously allowed contract", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()

      // allow contract
      await safeModule
        .connect(owner)
        .allowContract(DEFAULT_ROLE_NAME, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      const { data: doEvenLessData } = await testContract.doEvenLess()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoEvenLess")

      // scope contract and only allow doNothing
      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: function not allowed")
    })

    it("allowing a contract loosens a previously allowed function", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()

      // scope contract and only allow doNothing
      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      const { data: doEvenLessData } = await testContract.doEvenLess()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.revertedWith("Permissions: function not allowed")

      // allow contract
      await safeModule
        .connect(owner)
        .allowContract(DEFAULT_ROLE_NAME, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoEvenLess")
    })

    it("disallowing one function does not impact other function allowances", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()
      const { data: doEvenLessData } = await testContract.doEvenLess()

      // scope contract then allow doNothing and doEventLess
      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.Call
        )
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doEvenLessData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoEvenLess")

      // revoke doEventLess
      await safeModule
        .connect(owner)
        .revokeFunction(DEFAULT_ROLE_NAME, testContract.address, doEvenLessData)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: function not allowed")
    })

    it("allow function with different operation", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareFixture()

      // scope contract then allow doNothing with send operation
      await safeModule
        .connect(owner)
        .scopeContract(DEFAULT_ROLE_NAME, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.revertedWith("Permissions: require call operation")

      // allow doNothing with delegateCall operation
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.DelegateCall
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: require delegatecall operation")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.not.reverted

      // allow doNothing with both operation
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.Both
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.not.reverted

      // allow doNothing with none operation
      await safeModule
        .connect(owner)
        .allowFunction(
          DEFAULT_ROLE_NAME,
          testContract.address,
          doNothingData,
          Operation.None
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.revertedWith("Permissions: opearion not config")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            DEFAULT_ROLE_NAME,
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.revertedWith("Permissions: opearion not config")
    })
  })
})
