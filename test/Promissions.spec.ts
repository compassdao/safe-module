import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import {
  Operation,
  padPermitSettledResult,
  PermitSettledResult,
  safeModuleFixture,
} from "./fixture/safeModuleFixture"
import { ethers } from "hardhat"
import { expect } from "chai"

const ROLE_ID = ethers.utils.zeroPad("0x01", 32)

const prepareDeployment = async () => {
  const customOwnerSafeModuleFixture = async () => {
    const [owner] = await ethers.getSigners()
    return safeModuleFixture(owner.address)
  }

  const fixture = await loadFixture(customOwnerSafeModuleFixture)
  const { testContract, safeModule } = fixture

  const [owner, other] = await ethers.getSigners()

  const { data: doNothingData } =
    await testContract.populateTransaction.doNothing()

  await safeModule.connect(owner).assignRole(other.address, ROLE_ID)

  return { ...fixture, doNothingData: doNothingData!, owner, other }
}

const newTestContract = () =>
  ethers.getContractFactory("TestContract").then((factory) => factory.deploy())

describe("Permissions", () => {
  describe("Mix", () => {
    it("should revert only assign role without contract config on role", async () => {
      const { safeModule, testContract, doNothingData, other } =
        await prepareDeployment()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.ContractScopeRejected)
        )
    })

    it("role not found", async () => {
      const { safeModule, testContract, doNothingData, owner } =
        await prepareDeployment()

      await expect(
        safeModule
          .connect(owner)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult())
    })

    it("function signature too short", async () => {
      const { safeModule, testContract, permissions, owner, other } =
        await prepareDeployment()

      await safeModule
        .connect(owner)
        .scopeContract(ROLE_ID, testContract.address)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            "0x000000",
            Operation.Call
          )
      ).to.be.revertedWithCustomError(permissions, "FunctionSignatureTooShort")
    })

    it("call contract with confused operation", async () => {
      const { safeModule, testContract, doNothingData, other } =
        await prepareDeployment()

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.None
          )
      ).to.be.revertedWith("Confused operation")

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Both
          )
      ).to.be.revertedWith("Confused operation")
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
      } = await prepareDeployment()

      // allow to send
      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoNothing")

      await safeModule
        .connect(owner)
        .revokeContract(ROLE_ID, testContract.address)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.ContractScopeRejected)
        )
    })

    it("allow contract with different operation", async () => {
      const {
        safeModule,

        testContract,
        doNothingData,
        owner,
        other,
      } = await prepareDeployment()

      // allow nothing
      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.None)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))

      // allow to send
      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))

      // allow to delegateCall
      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.DelegateCall)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.not.reverted // event has bound to delegateCallee

      // allow both
      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.Both)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      ).to.be.not.reverted // event has bound to delegateCallee
    })

    it("allowing a contract but not allow other contract", async () => {
      const {
        safeModule,

        testContract,
        doNothingData,
        owner,
        other,
      } = await prepareDeployment()

      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            anotherTestContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.ContractScopeRejected)
        )
    })
  })

  describe("Function", () => {
    it("allows and then disallows a function", async () => {
      const {
        safeModule,
        testContract,

        doNothingData,
        owner,
        other,
      } = await prepareDeployment()

      // scope contract and allow function
      await safeModule
        .connect(owner)
        .scopeContract(ROLE_ID, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.FunctionScopeRejected)
        )

      // revoke function
      await safeModule
        .connect(owner)
        .revokeFunction(ROLE_ID, testContract.address, doNothingData)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.FunctionScopeRejected)
        )

      // revoke contract
      await safeModule
        .connect(owner)
        .revokeContract(ROLE_ID, testContract.address)
      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.ContractScopeRejected)
        )
    })

    it("allowing function on a target does not allow same function on diff target", async () => {
      const {
        safeModule,
        testContract,

        doNothingData,
        owner,
        other,
      } = await prepareDeployment()

      // scope contract and allow function
      await safeModule
        .connect(owner)
        .scopeContract(ROLE_ID, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            anotherTestContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.ContractScopeRejected)
        )
    })

    it("allowing a function tightens a previously allowed target", async () => {
      const {
        safeModule,
        testContract,

        doNothingData,
        owner,
        other,
      } = await prepareDeployment()

      // allow contract
      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoEvenLess")

      // scope contract and only allow doNothing
      await safeModule
        .connect(owner)
        .scopeContract(ROLE_ID, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.FunctionScopeRejected)
        )
    })

    it("allowing a target loosens a previously allowed function", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareDeployment()

      // scope contract and only allow doNothing
      await safeModule
        .connect(owner)
        .scopeContract(ROLE_ID, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.FunctionScopeRejected)
        )

      // allow contract
      await safeModule
        .connect(owner)
        .allowContract(ROLE_ID, testContract.address, Operation.Call)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoEvenLess")
    })

    it("disallowing one function does not impact other function allowances", async () => {
      const {
        safeModule,
        testContract,

        doNothingData,
        owner,
        other,
      } = await prepareDeployment()
      const { data: doEvenLessData } = await testContract.doEvenLess()

      // scope contract then allow doNothing and doEventLess
      await safeModule
        .connect(owner)
        .scopeContract(ROLE_ID, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.Call
        )
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doEvenLessData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      ).to.be.emit(testContract, "DoEvenLess")

      // revoke doEventLess
      await safeModule
        .connect(owner)
        .revokeFunction(ROLE_ID, testContract.address, doEvenLessData)

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doEvenLessData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(
          padPermitSettledResult(PermitSettledResult.FunctionScopeRejected)
        )
    })

    it("allow function with different operation", async () => {
      const { safeModule, testContract, doNothingData, owner, other } =
        await prepareDeployment()

      // scope contract then allow doNothing with send operation
      await safeModule
        .connect(owner)
        .scopeContract(ROLE_ID, testContract.address)
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.Call
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))

      // allow doNothing with delegateCall operation
      await safeModule
        .connect(owner)
        .allowFunction(
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.DelegateCall
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.Both
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
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
          ROLE_ID,
          testContract.address,
          doNothingData,
          Operation.None
        )

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.Call
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))

      await expect(
        safeModule
          .connect(other)
          .execTransactionFromModule(
            testContract.address,
            0,
            doNothingData,
            Operation.DelegateCall
          )
      )
        .to.be.revertedWithCustomError(safeModule, "PermitReject")
        .withArgs(padPermitSettledResult(PermitSettledResult.OperationRejected))
    })
  })
})
