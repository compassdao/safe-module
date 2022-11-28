import { ethers } from "hardhat"
import { SafeModule } from "../typechain-types"

const uniV3Abi = ["function multicall(uint256 deadline, bytes[] calldata data)"]

export const multicallProxy = async (
  safeModuleAddress: string,
  uniswapAddress: string,
  data: string,
  inputOP: number,
  ethValue = 0
) => {
  const uniswap = new ethers.Contract(uniswapAddress, uniV3Abi, ethers.provider)
  const decodedCall = uniswap.interface.decodeFunctionData("multicall", data)

  const calls: SafeModule.ExecStruct[] = [
    {
      to: uniswapAddress,
      value: 0,
      data: uniswap.interface.encodeFunctionData("multicall", [
        decodedCall.deadline, // 1. check deadline
        [],
      ]),
      inputOP,
    },
    ...decodedCall.data.map((i: any) => ({
      to: uniswapAddress,
      value: ethValue, // 2. add it only on swap
      data: i,
      inputOP,
    })),
  ]

  const safeModule = await ethers.getContractAt("SafeModule", safeModuleAddress)
  const proxyCall = await safeModule.execTransactionsFromModule(calls)

  console.log("proxy: ", proxyCall.hash)
}
