// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.6;

import "./Ownable.sol";
import "./GnosisSafe.sol";
import "./Permissions.sol";

contract SafeModule is Ownable {
  uint256 internal constant _MAX_ROLE_PER_MEMBER = 16;

  mapping(bytes32 => Role) internal roles;
  mapping(address => bytes32[_MAX_ROLE_PER_MEMBER]) internal members;
  mapping(bytes32 => bool) deprecatedRoles;

  address public _safeProxy;

  constructor(address owner, address payable safeProxy) {
    require(safeProxy != address(0), "Invalid safe proxy");
    _transferOwnership(owner);
    _safeProxy = safeProxy;
  }

  error RoleExceeded();
  error RoleNotFound();
  error BlankRoleId();
  error RoleDeprecated();

  event AssignRoleToMember(address member, bytes32 roleId);
  event RevokeRoleFromMember(address member, bytes32 roleId);
  event DeprecateRole(bytes32 roleId);
  event DropMember(address member);
  event ExecTransaction(
    address to,
    uint256 value,
    bytes data,
    Operation inputOP,
    address sender
  );

  modifier isValidRoleId(bytes32 roleId) {
    if (roleId == 0) {
      revert BlankRoleId();
    } else if (deprecatedRoles[roleId]) {
      revert RoleDeprecated();
    }

    _;
  }

  function assignRole(address member, bytes32 roleId)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    bool assigned = false;

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      if (members[member][i] == 0 || members[member][i] == roleId) {
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

  function revokeRole(address member, bytes32 roleId)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    bool revoke = false;

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      if (members[member][i] == roleId) {
        members[member][i] = 0;
        revoke = true;
      }
    }

    if (revoke) {
      emit RevokeRoleFromMember(member, roleId);
    }
  }

  function deprecateRole(bytes32 roleId)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    deprecatedRoles[roleId] = true;
    emit DeprecateRole(roleId);
  }

  function dropMember(address member) external onlyOwner {
    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      members[member][i] = 0;
    }

    emit DropMember(member);
  }

  function rolesOf(address member)
    public
    view
    returns (bytes32[] memory validRoles)
  {
    validRoles = new bytes32[](_MAX_ROLE_PER_MEMBER);

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      bytes32 roleId = members[member][i];

      if (roleId == 0 || deprecatedRoles[roleId] == true) {
        continue;
      }

      validRoles[i] = roleId;
    }
  }

  function allowContract(
    bytes32 roleId,
    address targetAddr,
    Operation op
  ) external onlyOwner isValidRoleId(roleId) {
    Permissions.allowContract(roles[roleId], roleId, targetAddr, op);
  }

  function revokeContract(bytes32 roleId, address targetAddr)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    Permissions.revokeContract(roles[roleId], roleId, targetAddr);
  }

  function scopeContract(bytes32 roleId, address targetAddr)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    Permissions.scopeContract(roles[roleId], roleId, targetAddr);
  }

  function allowFunction(
    bytes32 roleId,
    address targetAddr,
    bytes4 funcSig,
    Operation op
  ) external onlyOwner isValidRoleId(roleId) {
    Permissions.allowFunction(roles[roleId], roleId, targetAddr, funcSig, op);
  }

  function revokeFunction(
    bytes32 roleId,
    address targetAddr,
    bytes4 funcSig
  ) external onlyOwner isValidRoleId(roleId) {
    Permissions.revokeFunction(roles[roleId], roleId, targetAddr, funcSig);
  }

  function scopeFunction(
    bytes32 roleId,
    address targetAddr,
    bytes4 funcSig,
    bool[] memory isScopeds,
    ParameterType[] memory paramTypes,
    Comparison[] memory cps,
    bytes[] calldata expectedValues,
    Operation op
  ) external onlyOwner isValidRoleId(roleId) {
    Permissions.scopeFunction(
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
  ) public {
    _execTransaction(to, value, data, inputOP);
  }

  function _execTransaction(
    address to,
    uint256 value,
    bytes memory data,
    Operation inputOP
  ) internal {
    require(
      inputOP == Operation.Send || inputOP == Operation.DelegateCall,
      "Confused operation"
    );
    _hasPermission(to, data, inputOP);

    require(
      GnosisSafe(payable(_safeProxy)).execTransactionFromModule(
        to,
        value,
        data,
        inputOP == Operation.DelegateCall
          ? Enum.Operation.DelegateCall
          : Enum.Operation.Call
      ),
      "Failed in execution in safe"
    );

    emit ExecTransaction(to, value, data, inputOP, _msgSender());
  }

  function _hasPermission(
    address to,
    bytes memory data,
    Operation inputOP
  ) internal view {
    bool checkAtLeastOnce = false;
    bytes32[] memory validRoles = rolesOf(_msgSender());

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      bytes32 roleId = validRoles[i];
      if (roleId == 0) {
        continue;
      }

      Permissions.check(roles[roleId], to, data, inputOP);
      checkAtLeastOnce = true;
    }

    if (!checkAtLeastOnce) {
      revert RoleNotFound();
    }
  }
}
