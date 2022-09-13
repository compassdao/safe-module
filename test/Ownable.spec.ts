import { safeModuleFixture } from "./fixture/safeModuleFixture"
import { expect } from "chai"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"

describe("Ownable", () => {
  it("setting owner same as safeProxy", async () => {
    const { safeProxy, safeModule } = await loadFixture(safeModuleFixture)
    expect(await safeModule.owner()).to.equal(safeProxy.address)
  })

  it("setting custom owner", async () => {
    const owner = "0x0000000000000000000000000000000000000001"
    const customOwnerSetting = () => safeModuleFixture(owner)

    const { safeProxy, safeModule } = await loadFixture(customOwnerSetting)
    expect(await safeModule.owner()).to.not.equal(safeProxy.address)
    expect(await safeModule.owner()).to.equal(owner)
  })
})
