// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.6;

import "./Ownable.sol";
import "./GnosisSafe.sol";
import "./Enums.sol";
import "./Permissions.sol";

contract SafeModule is Ownable {
  error RoleExceeded();
  error PermitReject(PermitSettledResult[] reason);
  error BlankRoleId();
  error RoleDeprecated();

  event ModuleSetup(address owner, address safeProxy);
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

  uint256 internal constant _MAX_ROLE_PER_MEMBER = 16;

  mapping(bytes32 => Role) internal roles;
  mapping(address => bytes32[_MAX_ROLE_PER_MEMBER]) internal members;
  mapping(bytes32 => bool) deprecatedRoles;

  address public _safeProxy;

  constructor(address owner, address payable safeProxy) {
    require(safeProxy != address(0), "Invalid safe proxy");
    _transferOwnership(owner);
    _safeProxy = safeProxy;

    emit ModuleSetup(owner, safeProxy);
  }

  modifier isValidRoleId(bytes32 roleId) {
    if (roleId == 0) {
      revert BlankRoleId();
    } else if (deprecatedRoles[roleId]) {
      revert RoleDeprecated();
    }

    _;
  }

  /// @dev Assign a role to a member
  /// @param member Assigned address
  /// @param roleId Id of a role
  /// @notice Can only be called by owner
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

  /// @dev Revoke a role from a member
  /// @param member Assigned address before
  /// @param roleId Id of a role
  /// @notice Can only be called by owner
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

  /// @dev Deprecate a roleId and this roleId can't used anymore
  /// @param roleId Id of a role
  /// @notice Can only be called by owner
  function deprecateRole(bytes32 roleId)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    deprecatedRoles[roleId] = true;
    emit DeprecateRole(roleId);
  }

  /// @dev Delete a member
  /// @param member Address to be deleted
  /// @notice Can only be called by owner
  function dropMember(address member) external onlyOwner {
    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      members[member][i] = 0;
    }

    emit DropMember(member);
  }

  /// @dev Get roles of an address for now
  /// @param member Member address
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

  /// @dev Allow the specific roleId to call the contract
  /// @param roleId Id of a role
  /// @param targetContract Allowed contract
  /// @param op Defines the operation is call or delegateCall
  /// @notice Can only be called by owner
  function allowContract(
    bytes32 roleId,
    address targetContract,
    Operation op
  ) external onlyOwner isValidRoleId(roleId) {
    Permissions.allowContract(roles[roleId], roleId, targetContract, op);
  }

  /// @dev Disable the specific roleId to call the contract
  /// @param roleId Id of a role
  /// @param targetContract Allowed contract
  /// @notice Can only be called by owner
  function revokeContract(bytes32 roleId, address targetContract)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    Permissions.revokeContract(roles[roleId], roleId, targetContract);
  }

  /// @dev Allow the specific roleId to call the function of contract
  /// @param roleId Id of a role
  /// @param targetContract Allowed contract
  /// @notice Can only be called by owner
  function scopeContract(bytes32 roleId, address targetContract)
    external
    onlyOwner
    isValidRoleId(roleId)
  {
    Permissions.scopeContract(roles[roleId], roleId, targetContract);
  }

  /// @dev Allow the specific roleId to call the function
  /// @param roleId Id of a role
  /// @param targetContract Allowed contract
  /// @param funcSig Function selector
  /// @param op Defines the operation is call or delegateCall
  /// @notice Can only be called by owner
  /// @notice Please call 'scopeContract' at the begin before config function
  function allowFunction(
    bytes32 roleId,
    address targetContract,
    bytes4 funcSig,
    Operation op
  ) external onlyOwner isValidRoleId(roleId) {
    Permissions.allowFunction(
      roles[roleId],
      roleId,
      targetContract,
      funcSig,
      op
    );
  }

  /// @dev Disable the specific roleId to call the function
  /// @param roleId Id of a role
  /// @param targetContract Allowed contract
  /// @param funcSig Function selector
  /// @notice Can only be called by owner
  function revokeFunction(
    bytes32 roleId,
    address targetContract,
    bytes4 funcSig
  ) external onlyOwner isValidRoleId(roleId) {
    Permissions.revokeFunction(roles[roleId], roleId, targetContract, funcSig);
  }

  /// @dev Allow the specific roleId to call the function with specific parameters
  /// @param roleId Id of a role
  /// @param targetContract Allowed contract
  /// @param funcSig Function selector
  /// @param isScopeds List of parameter scoped config, false for un-scoped, true for scoped
  /// @param paramTypes List of parameter types, Static, Dynamic or Dynamic32, use Static type if not scoped
  /// @param cps List of parameter comparison types, Eq, Gt or Lt, use Eq if not scoped
  /// @param expectedValues List of expected values, use '0x' if not scoped
  /// @param op Defines the operation is call or delegateCall
  /// @notice Can only be called by owner
  /// @notice Please call 'scopeContract' at the begin before config function
  function scopeFunction(
    bytes32 roleId,
    address targetContract,
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
      targetContract,
      funcSig,
      isScopeds,
      paramTypes,
      cps,
      expectedValues,
      op
    );
  }

  /// @dev Check then exec transaction
  /// @param to To address of the transaction
  /// @param value Ether value of the transaction
  /// @param data Data payload of the transaction
  /// @param inputOP Operation to execute the transaction, only call or delegateCall
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
      inputOP == Operation.Call || inputOP == Operation.DelegateCall,
      "Confused operation"
    );
    _checkPermission(to, data, inputOP);

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

  function _checkPermission(
    address to,
    bytes memory data,
    Operation inputOP
  ) internal view {
    bytes32[] memory validRoles = rolesOf(_msgSender());
    PermitSettledResult[] memory results = new PermitSettledResult[](
      _MAX_ROLE_PER_MEMBER
    );

    for (uint256 i = 0; i < _MAX_ROLE_PER_MEMBER; ++i) {
      bytes32 roleId = validRoles[i];
      if (roleId == 0) {
        continue;
      }

      results[i] = Permissions.check(roles[roleId], to, data, inputOP);
      if (results[i] == PermitSettledResult.Fulfilled) {
        return;
      }
    }

    revert PermitReject(results);
  }
}
