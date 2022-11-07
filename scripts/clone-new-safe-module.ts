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

// goerli
// export const MASTER_COPY_FACTORY = "0x32dB1A2A54AcBa087708d5BD3915F89ade2F5C1B"
// export const PATTERN_ADDRESS = "0x5C4e16233489626B760F2971A08fAC093B2382ae"

// polygon
export const MASTER_COPY_FACTORY = "0xDf4a841965177E4617c029e93925B2411d615c40"
export const PATTERN_ADDRESS = "0x65CBEfE8D6Da573bCc286e1c319820f3aa959bA2"

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
