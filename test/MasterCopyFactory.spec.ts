import { expect } from "chai"
import { ethers } from "hardhat"
import { calculateCopiedAddress } from "../scripts/calculate_copied_address"
import { safeModuleFixture } from "./fixture/safeModuleFixture"

describe("MasterCopyFactory", () => {
  it("deployModule", async () => {
    const masterCopyFactory = await ethers
      .getContractFactory("MasterCopyFactory")
      .then((factory) => factory.deploy())

    await masterCopyFactory.deployed()
    console.log("masterCopyFactory: ", masterCopyFactory.address)

    const [owner] = await ethers.getSigners()
    const { safeModule: pattern, safeProxy } = await safeModuleFixture(
      owner.address
    )
    console.log("patternAddress: ", pattern.address)

    const encodedInitParams = ethers.utils.defaultAbiCoder.encode(
      ["address", "address"],
      [owner.address, safeProxy.address]
    )
    const initializer = await pattern.interface.encodeFunctionData("setUp", [
      encodedInitParams,
    ])

    const saltNonce = Date.now().toString()

    const copiedAddress = calculateCopiedAddress(
      masterCopyFactory.address,
      pattern.address,
      initializer,
      saltNonce
    )
    console.log("calculated copiedAddress: ", copiedAddress)

    await expect(
      masterCopyFactory.deployModule(pattern.address, initializer, saltNonce)
    )
      .to.be.emit(masterCopyFactory, "MasterCopied")
      .withArgs(pattern.address, copiedAddress)
  })
})
