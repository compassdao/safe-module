// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.6;
import "./Enums.sol";

struct ScopedContract {
  Scope scope;
  Operation op;
}

struct Role {
  mapping(address => ScopedContract) contracts;
  mapping(bytes32 => uint256) functions;
  mapping(bytes32 => bytes32) expectedValues;
}

library Permissions {
  uint256 internal constant _SCOPE_MAX_PARAMS = 48;

  event AllowContract(
    bytes32 roleId,
    address targetContract,
    Operation operation
  );

  event RevokeContract(bytes32 roleId, address targetContract);

  event ScopeContract(bytes32 roleId, address targetContract);

  event AllowFunction(
    bytes32 roleId,
    address targetContract,
    bytes4 functionSig,
    Operation operation,
    uint256 funcScopedFlag
  );

  event RevokeFunction(
    bytes32 roleId,
    address targetContract,
    bytes4 functionSig,
    uint256 funcScopedFlag
  );

  event ScopeFunction(
    bytes32 roleId,
    address targetContract,
    bytes4 functionSig,
    bool[] isScopeds,
    ParameterType[] paramTypes,
    Comparison[] comparisons,
    bytes[] expectedValues,
    Operation operation,
    uint256 funcScopedFlag
  );

  /// Function signature too short
  error FunctionSignatureTooShort();

  /// The provided calldata for execution is too short, or an OutOfBounds scoped parameter was configured
  error CalldataOutOfBounds();

  /// Arrays must be the same length
  error ArraysDifferentLength();

  /// Exceeds the max number of params supported
  error ScopeMaxParametersExceeded();

  /// Not possible to define gt/lt for Dynamic types
  error UnsuitableRelativeComparison();

  /// Expected value for static types should have a size of exactly 32 bytes
  error UnsuitableStaticExpectedValueSize();

  /// Expected value for Dynamic32 types should be a multiple of exactly 32 bytes
  error UnsuitableDynamic32ExpectedValueSize();

  function check(
    Role storage role,
    address to,
    bytes calldata data,
    Operation inputOP
  ) public view returns (PermitSettledResult) {
    return _checkTransaction(role, to, data, inputOP);
  }

  function _checkTransaction(
    Role storage role,
    address targetContract,
    bytes memory data,
    Operation inputOP
  ) internal view returns (PermitSettledResult) {
    if (data.length < 4) {
      revert FunctionSignatureTooShort();
    }

    ScopedContract storage scopedContract = role.contracts[targetContract];
    if (scopedContract.scope == Scope.Contract) {
      return
        _checkOP(inputOP, scopedContract.op)
          ? PermitSettledResult.Fulfilled
          : PermitSettledResult.OperationRejected;
    } else if (scopedContract.scope == Scope.Function) {
      uint256 funcScopedFlag = role.functions[
        _key4Func(targetContract, bytes4(data))
      ];

      if (funcScopedFlag == 0) {
        return PermitSettledResult.FunctionScopeRejected;
      }

      (Operation scopedFuncOP, bool isBypass, ) = _unpackLeft(funcScopedFlag);

      if (!_checkOP(inputOP, scopedFuncOP)) {
        return PermitSettledResult.OperationRejected;
      } else if (isBypass) {
        return PermitSettledResult.Fulfilled;
      }

      return
        _checkParameters(role, funcScopedFlag, targetContract, data)
          ? PermitSettledResult.Fulfilled
          : PermitSettledResult.ParametersScopeRejected;
    }

    return PermitSettledResult.ContractScopeRejected;
  }

  function _checkParameters(
    Role storage role,
    uint256 funcScopedFlag,
    address targetContract,
    bytes memory data
  ) internal view returns (bool permitted) {
    permitted = false;

    bytes4 funcSig = bytes4(data);
    (, , uint256 argsCount) = _unpackLeft(funcScopedFlag);

    for (uint256 i = 0; i < argsCount; ++i) {
      (bool isScoped, ParameterType paramType, Comparison cp) = _unpackRight(
        funcScopedFlag,
        i
      );

      if (!isScoped) {
        continue;
      }

      bytes32 inputValue;
      if (paramType != ParameterType.Static) {
        inputValue = _pluckDynamicValue(data, paramType, i);
      } else {
        inputValue = _pluckStaticValue(data, i);
      }

      bytes32 key = _key4FuncArg(targetContract, funcSig, i);
      permitted = _compare(cp, role.expectedValues[key], inputValue);

      if (!permitted) {
        break;
      }
    }
  }

  function _compare(
    Comparison cp,
    bytes32 expectedValue,
    bytes32 inputValue
  ) internal pure returns (bool) {
    if (
      (cp == Comparison.Eq && inputValue == expectedValue) ||
      (cp == Comparison.Gt && inputValue > expectedValue) ||
      (cp == Comparison.Lt && inputValue < expectedValue)
    ) {
      return true;
    }

    return false;
  }

  function _checkOP(Operation inputOP, Operation scopedOP)
    internal
    pure
    returns (bool)
  {
    if (
      ((scopedOP == Operation.Call || scopedOP == Operation.DelegateCall) &&
        inputOP == scopedOP) ||
      (scopedOP == Operation.Both &&
        (inputOP == Operation.Call || inputOP == Operation.DelegateCall))
    ) {
      return true;
    }

    return false;
  }

  function _key4Func(address addr, bytes4 funcSig)
    internal
    pure
    returns (bytes32)
  {
    return bytes32(abi.encodePacked(addr, funcSig));
  }

  function _key4FuncArg(
    address addr,
    bytes4 funcSig,
    uint256 index
  ) public pure returns (bytes32) {
    return bytes32(abi.encodePacked(addr, funcSig, uint8(index)));
  }

  function _pluckStaticValue(bytes memory data, uint256 index)
    internal
    pure
    returns (
      bytes32 // todo why?
    )
  {
    // pre-check: is there a word available for the current parameter at argumentsBlock?
    if (data.length < 4 + index * 32 + 32) {
      revert CalldataOutOfBounds();
    }

    uint256 offset = 4 + index * 32;
    bytes32 value;
    assembly {
      // add 32 - jump over the length encoding of the data bytes array
      value := mload(add(32, add(data, offset)))
    }
    return value;
  }

  function _pluckDynamicValue(
    bytes memory data,
    ParameterType paramType,
    uint256 index
  ) internal pure returns (bytes32) {
    // todo why?
    assert(paramType != ParameterType.Static);
    // pre-check: is there a word available for the current parameter at argumentsBlock?
    if (data.length < 4 + index * 32 + 32) {
      revert CalldataOutOfBounds();
    }

    /*
     * Encoded calldata:
     * 4  bytes -> function selector
     * 32 bytes -> sequence, one chunk per parameter
     *
     * There is one (bytes32) chunk per parameter. Depending on type it contains:
     * Static    -> value encoded inline (not plucked by this function)
     * Dynamic   -> a byte offset to encoded data payload
     * Dynamic32 -> a byte offset to encoded data payload
     * Note: Fixed Sized Arrays (e.g., bool[2]), are encoded inline
     * Note: Nested types also do not follow the above described rules, and are unsupported
     * Note: The offset to payload does not include 4 bytes for functionSig
     *
     *
     * At encoded payload, the first 32 bytes are the length encoding of the parameter payload. Depending on ParameterType:
     * Dynamic   -> length in bytes
     * Dynamic32 -> length in bytes32
     * Note: Dynamic types are: bytes, string
     * Note: Dynamic32 types are non-nested arrays: address[] bytes32[] uint[] etc
     */

    // the start of the parameter block
    // 32 bytes - length encoding of the data bytes array
    // 4  bytes - function sig
    uint256 argumentsBlock;
    assembly {
      argumentsBlock := add(data, 36)
    }

    // the two offsets are relative to argumentsBlock
    uint256 offset = index * 32;
    uint256 offsetPayload;
    assembly {
      offsetPayload := mload(add(argumentsBlock, offset))
    }

    uint256 lengthPayload;
    assembly {
      lengthPayload := mload(add(argumentsBlock, offsetPayload))
    }

    // account for:
    // 4  bytes - functionSig
    // 32 bytes - length encoding for the parameter payload
    uint256 start = 4 + offsetPayload + 32;
    uint256 end = start +
      (
        paramType == ParameterType.Dynamic32
          ? lengthPayload * 32
          : lengthPayload
      );

    // are we slicing out of bounds?
    if (data.length < end) {
      revert CalldataOutOfBounds();
    }

    return keccak256(_slice(data, start, end));
  }

  function _slice(
    bytes memory data,
    uint256 start,
    uint256 end
  ) internal pure returns (bytes memory result) {
    result = new bytes(end - start);
    for (uint256 j = start; j < end; j++) {
      result[j - start] = data[j];
    }
  }

  function allowContract(
    Role storage role,
    bytes32 roleId,
    address targetContract,
    Operation op
  ) external {
    role.contracts[targetContract] = ScopedContract(Scope.Contract, op);
    emit AllowContract(roleId, targetContract, op);
  }

  function revokeContract(
    Role storage role,
    bytes32 roleId,
    address targetContract
  ) external {
    role.contracts[targetContract] = ScopedContract(Scope.None, Operation.None);
    emit RevokeContract(roleId, targetContract);
  }

  function scopeContract(
    Role storage role,
    bytes32 roleId,
    address targetContract
  ) external {
    role.contracts[targetContract] = ScopedContract(
      Scope.Function,
      Operation.None
    );
    emit ScopeContract(roleId, targetContract);
  }

  function allowFunction(
    Role storage role,
    bytes32 roleId,
    address targetContract,
    bytes4 funcSig,
    Operation op
  ) external {
    uint256 funcScopedFlag = _packLeft(0, op, true, 0);
    role.functions[_key4Func(targetContract, funcSig)] = funcScopedFlag;

    emit AllowFunction(roleId, targetContract, funcSig, op, funcScopedFlag);
  }

  function revokeFunction(
    Role storage role,
    bytes32 roleId,
    address targetContract,
    bytes4 funcSig
  ) external {
    role.functions[_key4Func(targetContract, funcSig)] = 0;
    emit RevokeFunction(roleId, targetContract, funcSig, 0);
  }

  function scopeFunction(
    Role storage role,
    bytes32 roleId,
    address targetContract,
    bytes4 funcSig,
    bool[] memory isScopeds,
    ParameterType[] memory paramTypes,
    Comparison[] memory cps,
    bytes[] calldata expectedValues,
    Operation op
  ) external {
    uint256 argsCount = isScopeds.length;

    if (
      argsCount != paramTypes.length ||
      argsCount != cps.length ||
      argsCount != expectedValues.length
    ) {
      revert ArraysDifferentLength();
    } else if (argsCount > _SCOPE_MAX_PARAMS) {
      revert ScopeMaxParametersExceeded();
    }

    for (uint256 i = 0; i < argsCount; ++i) {
      if (isScopeds[i]) {
        _checkExpectedComparison(paramTypes[i], cps[i]);
        _checkExpectedValue(paramTypes[i], expectedValues[i]);
      }
    }

    uint256 funcScopedFlag = _packLeft(0, op, false, argsCount);

    for (uint256 i = 0; i < argsCount; ++i) {
      funcScopedFlag = _packRight(
        funcScopedFlag,
        i,
        isScopeds[i],
        paramTypes[i],
        cps[i]
      );
    }

    role.functions[_key4Func(targetContract, funcSig)] = funcScopedFlag;

    for (uint256 i = 0; i < argsCount; ++i) {
      role.expectedValues[
        _key4FuncArg(targetContract, funcSig, i)
      ] = _compressExpectedValue(paramTypes[i], expectedValues[i]);
    }

    emit ScopeFunction(
      roleId,
      targetContract,
      funcSig,
      isScopeds,
      paramTypes,
      cps,
      expectedValues,
      op,
      funcScopedFlag
    );
  }

  function _compressExpectedValue(
    ParameterType paramType,
    bytes calldata expectedValue
  ) internal pure returns (bytes32) {
    return
      paramType == ParameterType.Static
        ? bytes32(expectedValue)
        : keccak256(expectedValue);
  }

  function _checkExpectedComparison(ParameterType paramType, Comparison cp)
    internal
    pure
  {
    // only supports 'eq' comparison for no-static type
    if (paramType != ParameterType.Static && cp != Comparison.Eq) {
      revert UnsuitableRelativeComparison();
    }
  }

  function _checkExpectedValue(
    ParameterType paramType,
    bytes calldata expectedValue
  ) internal pure {
    if (paramType == ParameterType.Static && expectedValue.length != 32) {
      revert UnsuitableStaticExpectedValueSize();
    }

    if (
      paramType == ParameterType.Dynamic32 && expectedValue.length % 32 != 0
    ) {
      revert UnsuitableDynamic32ExpectedValueSize();
    }
  }

  // LEFT SIDE
  // 2   bits -> options
  // 1   bits -> isBypass
  // 5   bits -> unused
  // 8   bits -> length
  function _packLeft(
    uint256 scopedFlag,
    Operation op,
    bool isBypass,
    uint256 length
  ) internal pure returns (uint256) {
    // Wipe the LEFT SIDE clean. Start from there
    scopedFlag = (scopedFlag << 16) >> 16;

    // set options -> 256 - 2 = 254
    scopedFlag |= uint256(op) << 254;

    // set isBypass -> 256 - 2 - 1 = 253
    if (isBypass) {
      scopedFlag |= 1 << 253;
    }

    // set Length -> 48 + 96 + 96 = 240
    scopedFlag |= length << 240;

    return scopedFlag;
  }

  function _unpackLeft(uint256 scopedFlag)
    internal
    pure
    returns (
      Operation op,
      bool isBypass,
      uint256 argsCount
    )
  {
    uint256 isBypassMask = 1 << 253;

    op = Operation(scopedFlag >> 254);
    isBypass = scopedFlag & isBypassMask != 0;
    argsCount = (scopedFlag << 8) >> 248;
  }

  // RIGHT SIDE
  // 48  bits -> isScoped
  // 96  bits -> paramType (2 bits per entry 48*2)
  // 96  bits -> paramComp (2 bits per entry 48*2)
  function _packRight(
    uint256 scopedFlag,
    uint256 index,
    bool isScoped,
    ParameterType paramType,
    Comparison paramComp
  ) internal pure returns (uint256) {
    uint256 isScopedMask = 1 << (index + 96 + 96);
    uint256 paramTypeMask = 3 << (index * 2 + 96);
    uint256 paramCompMask = 3 << (index * 2);

    if (isScoped) {
      scopedFlag |= isScopedMask;
    } else {
      scopedFlag &= ~isScopedMask;
    }

    scopedFlag &= ~paramTypeMask;
    scopedFlag |= uint256(paramType) << (index * 2 + 96);

    scopedFlag &= ~paramCompMask;
    scopedFlag |= uint256(paramComp) << (index * 2);

    return scopedFlag;
  }

  function _unpackRight(uint256 scopedFlag, uint256 index)
    internal
    pure
    returns (
      bool isScoped,
      ParameterType paramType,
      Comparison cp
    )
  {
    uint256 isScopedMask = 1 << (index + 96 + 96);
    uint256 paramTypeMask = 3 << (index * 2 + 96);
    uint256 paramCompMask = 3 << (index * 2);

    isScoped = (scopedFlag & isScopedMask) != 0;
    paramType = ParameterType((scopedFlag & paramTypeMask) >> (index * 2 + 96));
    cp = Comparison((scopedFlag & paramCompMask) >> (index * 2));
  }
}
