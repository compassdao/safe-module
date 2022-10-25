import { ethers } from "ethers"

export const calculateCopiedAddress = (
  factory: string,
  pattern: string,
  initData: string,
  saltNonce: string
) => {
  const patternAddress = pattern.toLowerCase().replace(/^0x/, "")
  const byteCode =
    "0x602d8060093d393df3363d3d373d3d3d363d73" +
    patternAddress +
    "5af43d82803e903d91602b57fd5bf3"

  const salt = ethers.utils.solidityKeccak256(
    ["bytes32", "uint256"],
    [ethers.utils.solidityKeccak256(["bytes"], [initData]), saltNonce]
  )

  return ethers.utils.getCreate2Address(
    factory,
    salt,
    ethers.utils.keccak256(byteCode)
  )
}
