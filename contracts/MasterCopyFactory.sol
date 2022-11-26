// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

contract MasterCopyFactory {
  event MasterCopied(address patternAddress, address copiedAddress);

  /// `target` can not be zero.
  error ZeroAddress(address target);

  /// `address_` is already taken.
  error TakenAddress(address address_);

  /// @notice Initialization failed.
  error FailedInitialization();

  function _clone(address target, bytes32 salt)
    internal
    returns (address copied)
  {
    if (address(target) == address(0)) {
      revert ZeroAddress(target);
    }

    bytes memory deployment = abi.encodePacked(
      hex"602d8060093d393df3363d3d373d3d3d363d73",
      target,
      hex"5af43d82803e903d91602b57fd5bf3"
    );

    // solhint-disable-next-line no-inline-assembly
    assembly {
      copied := create2(0, add(deployment, 0x20), mload(deployment), salt)
    }

    if (copied == address(0)) {
      revert TakenAddress(copied);
    }
  }

  function deployModule(
    address patternAddress,
    bytes memory initializer,
    uint256 saltNonce
  ) public returns (address copiedAddress) {
    copiedAddress = _clone(
      patternAddress,
      keccak256(abi.encodePacked(keccak256(initializer), saltNonce))
    );

    (bool success, ) = copiedAddress.call(initializer);
    if (!success) {
      revert FailedInitialization();
    }

    emit MasterCopied(patternAddress, copiedAddress);
  }
}
