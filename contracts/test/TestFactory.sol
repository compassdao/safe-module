// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity ^0.8.0;

contract TestFactory {
  address public one;
  address public two;

  constructor(address _one, address _two) {
    bytes memory initializeParams = abi.encode(_one, _two);
    setUp(initializeParams);
  }

  function setUp(bytes memory initializeParams) public {
    (address _one, address _two) = abi.decode(
      initializeParams,
      (address, address)
    );

    one = _one;
    two = _two;
  }
}
