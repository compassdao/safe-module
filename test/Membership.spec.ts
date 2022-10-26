import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { role, safeModuleFixture } from "./fixture/safeModuleFixture"
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

describe("Membership", () => {
  it("assign Roles", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    await expect(
      safeModule.connect(owner).assignRoles(other.address, [role(1)])
    )
      .to.be.emit(safeModule, "AssignRoles")
      .withArgs(other.address, [role(1)])

    await expect(
      safeModule
        .connect(owner)
        .assignRoles(other.address, [role(1), role(0), role(1), role(2)])
    )
      .to.be.emit(safeModule, "AssignRoles")
      .withArgs(other.address, [role(1), role(0), role(1), role(2)])

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq([
      role(1),
      role(0),
      role(1),
      role(2),
      ...new Array(12).fill(role(0)),
    ])
  })

  it("supports up to 16 roleIds", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    await expect(
      safeModule.connect(owner).assignRoles(
        other.address,
        new Array(17).fill(0).map((_, index) => role(index + 1))
      )
    )
      .to.be.emit(safeModule, "AssignRoles")
      .withArgs(
        other.address,
        new Array(16).fill(0).map((_, index) => role(index + 1))
      )

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16).fill(0).map((_, index) => role(index + 1))
    )
  })

  it("deprecate role", async () => {
    const { safeModule, owner, other } = await prepareDeployment()

    await expect(
      safeModule.connect(owner).assignRoles(
        other.address,
        new Array(17).fill(0).map((_, index) => role(index + 1))
      )
    )
      .to.be.emit(safeModule, "AssignRoles")
      .withArgs(
        other.address,
        new Array(16).fill(0).map((_, index) => role(index + 1))
      )

    await expect(safeModule.connect(owner).deprecateRole(role(1)))
      .to.be.emit(safeModule, "DeprecateRole")
      .withArgs(role(1))

    await expect(safeModule.connect(owner).deprecateRole(role(10)))
      .to.be.emit(safeModule, "DeprecateRole")
      .withArgs(role(10))

    await expect(safeModule.connect(owner).deprecateRole(role(1)))
      .to.be.revertedWithCustomError(safeModule, "RoleDeprecated")
      .withArgs(role(1))

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16)
        .fill(0)
        .map((_, index) => role(index === 0 || index === 9 ? 0 : index + 1))
    )

    // can not assign roleId 1 again
    await expect(
      safeModule.connect(owner).assignRoles(other.address, [role(1)])
    )
      .to.be.revertedWithCustomError(safeModule, "RoleDeprecated")
      .withArgs(role(1))

    // can not assign roleId 10 again
    await expect(
      safeModule.connect(owner).assignRoles(other.address, [role(10)])
    )
      .to.be.revertedWithCustomError(safeModule, "RoleDeprecated")
      .withArgs(role(10))

    // assign others
    await expect(
      safeModule.connect(owner).assignRoles(
        other.address,
        new Array(16).fill(0).map((_, index) => role(index + 100))
      )
    )
      .to.be.emit(safeModule, "AssignRoles")
      .withArgs(
        other.address,
        new Array(16).fill(0).map((_, index) => role(index + 100))
      )

    await expect(await safeModule.rolesOf(other.address)).to.be.deep.eq(
      new Array(16).fill(0).map((_, index) => role(index + 100))
    )
  })
})
