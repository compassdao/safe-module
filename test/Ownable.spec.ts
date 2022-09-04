import { deploySafeModuleForTest } from "./_deploySafeModule"
import { expect } from "chai"

describe("Ownable", () => {
  it("should set correct owner", async () => {
    const owner = "0x0000000000000000000000000000000000000002"
    const contract = await deploySafeModuleForTest(owner)
    expect(await contract.owner()).to.equal(owner)
  })
})
