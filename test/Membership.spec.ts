import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { safeModuleFixture } from "./fixture/safeModuleFixture"
import { ethers } from "hardhat"
import { expect } from "chai"

const prepareDeployment = async () => {
  const customOwnerSafeModuleFixture = async () => {
    const [owner] = await ethers.getSigners()
    return safeModuleFixture(owner.address)
  }

  const fixture = await loadFixture(customOwnerSafeModuleFixture)
  const [owner, other] = await ethers.getSigners()

  return { ...fixture, owner, other }
}

const bytes32 = (i: number) => {
  let h = i.toString(16)
  h = h.length % 2 == 1 ? `0${h}` : h
  return ethers.utils.hexlify(ethers.utils.zeroPad(`0x${h}`, 32))
}

const ROLE_ID = ethers.utils.hexlify(ethers.utils.zeroPad("0x01", 32))
const ROLE_BLANK = ethers.utils.hexlify(ethers.utils.zeroPad("0x", 32))

describe("Membership", () => {
  it("assign Role", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    await expect(
      safeModule.connect(owner).assignRole(other.address, ROLE_ID)
    ).to.be.emit(safeModule, "AssignRoleToMember")

    // again
    await expect(
      safeModule.connect(owner).assignRole(other.address, ROLE_ID)
    ).to.be.emit(safeModule, "AssignRoleToMember")

    // only assign one roleId
    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq([
      ROLE_ID,
      ...new Array(15).fill(ROLE_BLANK),
    ])
  })

  it("roleId should not be 0", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    await expect(
      safeModule
        .connect(owner)
        .assignRole(other.address, ethers.utils.zeroPad("0x", 32))
    ).to.be.revertedWithCustomError(safeModule, "BlankRoleId")
  })

  it("supports up to 16 roleIds", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    for (let i = 0; i < 16; ++i) {
      await expect(
        safeModule.connect(owner).assignRole(other.address, bytes32(i + 1))
      ).to.be.emit(safeModule, "AssignRoleToMember")
    }

    await expect(
      safeModule.connect(owner).assignRole(other.address, bytes32(17))
    ).to.be.revertedWithCustomError(safeModule, "RoleExceeded")

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16).fill(null).map((_, i) => bytes32(i + 1))
    )
  })

  it("revert roleId", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    for (let i = 0; i < 16; ++i) {
      await expect(
        safeModule.connect(owner).assignRole(other.address, bytes32(i + 1))
      ).to.be.emit(safeModule, "AssignRoleToMember")
    }

    await expect(
      safeModule.connect(owner).revokeRole(other.address, bytes32(1))
    ).to.be.emit(safeModule, "RevokeRoleFromMember")

    await expect(
      safeModule.connect(owner).revokeRole(other.address, bytes32(1))
    ).to.be.not.emit(safeModule, "RevokeRoleFromMember")

    await expect(
      safeModule.connect(owner).revokeRole(other.address, bytes32(16))
    ).to.be.emit(safeModule, "RevokeRoleFromMember")

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16)
        .fill(null)
        .map((_, i) => (i == 0 || i == 15 ? bytes32(0) : bytes32(i + 1)))
    )
  })

  it("deprecate role", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    for (let i = 0; i < 16; ++i) {
      await expect(
        safeModule.connect(owner).assignRole(other.address, bytes32(i + 1))
      ).to.be.emit(safeModule, "AssignRoleToMember")
    }

    await expect(
      safeModule.connect(owner).deprecateRole(bytes32(1))
    ).to.be.emit(safeModule, "DeprecateRole")

    await expect(
      safeModule.connect(owner).deprecateRole(bytes32(1))
    ).to.be.revertedWithCustomError(safeModule, "RoleDeprecated")

    await expect(
      safeModule.connect(owner).revokeRole(other.address, bytes32(16))
    ).to.be.emit(safeModule, "RevokeRoleFromMember")

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16)
        .fill(null)
        .map((_, i) => (i == 0 || i == 15 ? bytes32(0) : bytes32(i + 1)))
    )

    // can not assign roleId 1 again
    await expect(
      safeModule.connect(owner).assignRole(other.address, bytes32(1))
    ).to.be.revertedWithCustomError(safeModule, "RoleDeprecated")

    // assign roleId 16 again
    await expect(
      safeModule.connect(owner).assignRole(other.address, bytes32(16))
    ).to.be.emit(safeModule, "AssignRoleToMember")

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16)
        .fill(null)
        .map((_, i) => (i == 0 ? bytes32(0) : bytes32(i + 1)))
    )
  })

  it("drop member", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    for (let i = 0; i < 16; ++i) {
      await expect(
        safeModule.connect(owner).assignRole(other.address, bytes32(i + 1))
      ).to.be.emit(safeModule, "AssignRoleToMember")
    }

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16).fill(null).map((_, i) => bytes32(i + 1))
    )

    await expect(
      safeModule.connect(owner).dropMember(other.address)
    ).to.be.emit(safeModule, "DropMember")

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16).fill(null).map(() => bytes32(0))
    )

    // assign again
    for (let i = 0; i < 16; ++i) {
      await expect(
        safeModule.connect(owner).assignRole(other.address, bytes32(i + 1))
      ).to.be.emit(safeModule, "AssignRoleToMember")
    }

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16).fill(null).map((_, i) => bytes32(i + 1))
    )
  })
})
