import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { role, safeModuleFixture } from "./fixture/safeModuleFixture"
import { expect } from "chai"

describe("Membership", () => {
  it("assign Roles", async () => {
    const { safeModule, owner, other } = await loadFixture(safeModuleFixture)

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

    expect(await safeModule.rolesOf(other.address)).to.deep.eq([
      role(1),
      role(0),
      role(1),
      role(2),
      ...new Array(12).fill(role(0)),
    ])

    expect(await safeModule.hasRole(other.address, role(1))).to.eq(true)
    expect(await safeModule.hasRole(other.address, role(2))).to.eq(true)
    expect(await safeModule.hasRole(other.address, role(3))).to.eq(false)
  })

  it("supports up to 16 role names", async () => {
    const { safeModule, owner, other } = await loadFixture(safeModuleFixture)

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

    expect(await safeModule.rolesOf(other.address)).to.deep.eq(
      new Array(16).fill(0).map((_, index) => role(index + 1))
    )
  })

  it("deprecate role", async () => {
    const { safeModule, owner, other } = await loadFixture(safeModuleFixture)

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

    await expect(
      safeModule.connect(owner).deprecateRole(role(1))
    ).to.be.revertedWith("SafeModule: role deprecated")

    expect(await safeModule.rolesOf(other.address)).to.deep.eq(
      new Array(16)
        .fill(0)
        .map((_, index) => role(index === 0 || index === 9 ? 0 : index + 1))
    )

    // can not assign roleName 1 again
    await expect(
      safeModule.connect(owner).assignRoles(other.address, [role(1)])
    ).to.be.revertedWith("SafeModule: role deprecated")

    // can not assign roleName 10 again
    await expect(
      safeModule.connect(owner).assignRoles(other.address, [role(10)])
    ).to.be.revertedWith("SafeModule: role deprecated")

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

    expect(await safeModule.rolesOf(other.address)).to.deep.eq(
      new Array(16).fill(0).map((_, index) => role(index + 100))
    )
  })
})
