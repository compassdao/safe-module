// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

import "./Ownable.sol";
import "./GnosisSafe.sol";
import "./Permissions.sol";

contract SafeModule is Ownable {
  uint256 internal constant _MAX_ROLE_PER_MEMBER = 16;

  mapping(uint16 => Role) internal roles;
  mapping(address => uint16[_MAX_ROLE_PER_MEMBER]) internal members;
  mapping(uint16 => bool) deprecatedRoles;

  constructor(address payable safeProxy) {
    require(safeProxy != address(0), "Invalid safe proxy");
    _transferOwnership(safeProxy);
  }

  error RoleExceeded();
  error RoleNotFound();

  event AssignRoleToMember(address member, uint16 roleId);
  event RevokeRoleFromMember(address member, uint16 roleId);
  event RoleDeprecated(uint16 roleId);
  event MemberDropped(address member);
  event ExecTransaction(
    address to,
    uint256 value,
    bytes data,
    Operation inputOP,
    address sender
  );

  function assignRole(address member, uint16 roleId) external onlyOwner {
    require(roleId != 0, "Invalid roleId");

    bool assigned = false;

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      if (members[member][i] == 0) {
        members[member][i] = roleId;
        assigned = true;
        break;
      }
    }

    if (assigned == false) {
      revert RoleExceeded();
    }

    emit AssignRoleToMember(member, roleId);
  }

  function revokeRole(address member, uint16 roleId) external onlyOwner {
    require(roleId != 0, "Invalid roleId");

    bool revoke = false;

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      if (members[member][i] == roleId) {
        members[member][i] = 0;
        revoke = true;
      }
    }

    if (revoke == false) {
      revert RoleNotFound();
    }

    emit RevokeRoleFromMember(member, roleId);
  }

  function deprecateRole(uint16 roleId) external onlyOwner {
    deprecatedRoles[roleId] = true;
    emit RoleDeprecated(roleId);
  }

  function dropMember(address member) external onlyOwner {
    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      members[member][i] = 0;
    }

    emit MemberDropped(member);
  }

  function rolesOf(address member)
    public
    view
    returns (uint16[] memory validRoles)
  {
    validRoles = new uint16[](_MAX_ROLE_PER_MEMBER);

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      uint16 roleId = members[member][i];

      if (roleId == 0 || deprecatedRoles[roleId] == true) {
        continue;
      }

      validRoles[i] = roleId;
    }
  }

  function allowContract(
    uint16 roleId,
    address targetAddr,
    Operation op
  ) external onlyOwner {
    Permissions.allowContract(roles[roleId], roleId, targetAddr, op);
  }

  function revokeContract(uint16 roleId, address targetAddr)
    external
    onlyOwner
  {
    Permissions.revokeContract(roles[roleId], roleId, targetAddr);
  }

  function allowFunction(
    uint16 roleId,
    address targetAddr,
    bytes4 funcSig,
    Operation op
  ) external onlyOwner {
    Permissions.allowFunction(roles[roleId], roleId, targetAddr, funcSig, op);
  }

  function revokeFunction(
    uint16 roleId,
    address targetAddr,
    bytes4 funcSig
  ) external onlyOwner {
    Permissions.revokeFunction(roles[roleId], roleId, targetAddr, funcSig);
  }

  function allowFunctionWithParameter(
    uint16 roleId,
    address targetAddr,
    bytes4 funcSig,
    bool[] memory isScopeds,
    ParameterType[] memory paramTypes,
    Comparison[] memory cps,
    bytes[] calldata expectedValues,
    Operation op
  ) external onlyOwner {
    Permissions.allowFunctionWithParameter(
      roles[roleId],
      roleId,
      targetAddr,
      funcSig,
      isScopeds,
      paramTypes,
      cps,
      expectedValues,
      op
    );
  }

  function execTransactionFromModule(
    address to,
    uint256 value,
    bytes calldata data,
    Operation inputOP
  ) public returns (bool success) {
    // exec
  }

  function _execTransaction(
    address to,
    uint256 value,
    bytes memory data,
    Operation inputOP
  ) internal {
    _hasPermission(to, value, data, inputOP);

    require(
      GnosisSafe(payable(owner())).execTransactionFromModule(
        to,
        value,
        data,
        Enum.Operation.Call
      ),
      "Failed in execution in safe"
    );

    emit ExecTransaction(to, value, data, inputOP, _msgSender());
  }

  function _hasPermission(
    address to,
    uint256 value,
    bytes memory data,
    Operation inputOP
  ) internal view {
    bool checkOnce = false;
    uint16[] memory validRoles = rolesOf(_msgSender());

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      uint16 roleId = validRoles[i];
      if (roleId == 0) {
        continue;
      }

      Permissions.check(roles[roleId], to, value, data, inputOP);
      checkOnce = true;
    }

    assert(checkOnce);
  }
}
