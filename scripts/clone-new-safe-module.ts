import { task } from "hardhat/config"
import { HardhatRuntimeEnvironment } from "hardhat/types"

export async function cloneNewSafeModule(
  ethers: HardhatRuntimeEnvironment["ethers"],
  owner: string,
  safeProxy: string,
  saltNonce: string,
  masterCopyFactoryAddress: string,
  patternAddress: string
) {
  const encodedInitParams = ethers.utils.defaultAbiCoder.encode(
    ["address", "address"],
    [owner, safeProxy]
  )
  const patternContract = await ethers.getContractAt(
    "SafeModule",
    patternAddress
  )
  const moduleSetupData = await patternContract.interface.encodeFunctionData(
    "setUp",
    [encodedInitParams]
  )

  const [deployer] = await ethers.getSigners()
  console.log("Cloning contracts with the account:", deployer.address)
  console.log("Account balance:", (await deployer.getBalance()).toString())

  const masterCopyFactory = await ethers.getContractAt(
    "MasterCopyFactory",
    masterCopyFactoryAddress
  )

  console.log("params: ", {
    patternAddress,
    moduleSetupData,
    saltNonce,
  })

  const copiedAddress = await masterCopyFactory
    .connect(deployer)
    .deployModule(patternAddress, moduleSetupData, saltNonce)

  console.log("Transaction submitted. txid: ", copiedAddress.hash)
}

export const MASTER_COPY_FACTORY = "0x32dB1A2A54AcBa087708d5BD3915F89ade2F5C1B"
export const PATTERN_ADDRESS = "0x5913A5F374AcA0711C05E3decacad4B53f262853"

task("cloneSafe", "Clone new safe module")
  .addParam("safeProxy")
  .addParam("saltNonce")
  .addOptionalParam("owner")
  .addOptionalParam("masterCopyFactory")
  .addOptionalParam("pattern")
  .setAction(
    async (
      taskArgs: {
        safeProxy: string
        saltNonce: string
        owner?: string
        masterCopyFactory?: string
        pattern?: string
      },
      hre
    ) => {
      const { safeProxy, saltNonce } = taskArgs
      const owner = taskArgs.owner ?? safeProxy
      const masterCopyFactory =
        taskArgs.masterCopyFactory ?? MASTER_COPY_FACTORY
      const pattern = taskArgs.pattern ?? PATTERN_ADDRESS

      console.log("Run script with: ", {
        owner,
        safeProxy,
        saltNonce,
        masterCopyFactory,
        pattern,
      })

      return cloneNewSafeModule(
        hre.ethers,
        owner,
        safeProxy,
        saltNonce,
        masterCopyFactory,
        pattern
      )
    }
  )
