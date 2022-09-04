// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

enum ParameterType {
    Static,
    Dynamic,
    Dynamic32
}

enum Comparison {
    Eq,
    Gt,
    Gte,
    Lt,
    Lte
}

enum Scope {
    None,
    Contract,
    Function
}

enum Operation {
    None,
    Send,
    DelegateCall,
    Both
}

struct ScopedContract {
    Scope scope;
    Operation op;
}

struct Role {
    mapping(address => bool) members;
    mapping(address => ScopedContract) contracts;
    mapping(bytes32 => uint256) functions;
    mapping(bytes32 => bytes32) expectedValues;
}

library Permissions {
    uint256 internal constant _SCOPE_MAX_PARAMS = 48;

    event AllowContract(
        uint16 role,
        address targetAddress,
        Operation operation
    );

    event RevokeContract(uint16 role, address targetAddress);

    event AllowFunction(
        uint16 roleId,
        address targetAddress,
        bytes4 functionSig,
        Operation operation,
        uint256 funcScopedFlag
    );

    event RevokeFunction(
        uint16 roleId,
        address targetAddress,
        bytes4 functionSig,
        uint256 funcScopedFlag
    );

    event AllowFunctionWithParameter(
        uint16 roleId,
        address targetAddress,
        bytes4 functionSig,
        bool[] isScopeds,
        ParameterType[] paramTypes,
        Comparison[] comparisons,
        bytes[] expectedValues,
        Operation operation,
        uint256 funcScopedFlag
    );

    /// Sender is not a member of the role
    error NoMembership();

    /// Function signature too short
    error FunctionSignatureTooShort();

    /// Role not allowed to call target address
    error TargetAddressNotAllowed();

    /// Role not allowed to call this function on target address
    error FunctionNotAllowed();

    /// operation is not allow
    error OperationNotAllow();

    /// Input operation must be one of 'Send' or 'DelegateCall'
    error InputOperationUnclear();

    /// Role not allowed to send to target address
    error SendNotAllowed();

    /// Role not allowed to delegate call to target address
    error DelegateCallNotAllowed();

    /// Input parameter is not equal to expected
    error ParameterNotEqualToExpected();

    /// Input parameter is not less than expected
    error ParameterNotLessThanExpected();

    /// Input parameter is not less than equal to expected
    error ParameterNotLessThanEqualToExpected();

    /// Input parameter is not greater than expected
    error ParameterNotGreaterThanExpected();

    /// Input parameter is not greater than equal to expected
    error ParameterNotGreaterThanEqualToExpected();

    /// The provided calldata for execution is too short, or an OutOfBounds scoped parameter was configured
    error CalldataOutOfBounds();

    /// Arrays must be the same length
    error ArraysDifferentLength();

    /// Exceeds the max number of params supported
    error ScopeMaxParametersExceeded();

    /// Not possible to define gt/gte/lt/lte for Dynamic types
    error UnsuitableRelativeComparison();

    /// Expected value for static types should have a size of exactly 32 bytes
    error UnsuitableStaticExpectedValueSize();

    /// Expected value for Dynamic32 types should be a multiple of exactly 32 bytes
    error UnsuitableDynamic32ExpectedValueSize();

    function check(
        Role storage role,
        address to,
        uint256 value,
        bytes calldata data,
        Operation inputOP
    ) public view {
        if (!role.members[msg.sender]) {
            revert NoMembership();
        }

        _checkTransaction(role, to, value, data, inputOP);
    }

    function _checkTransaction(
        Role storage role,
        address targetAddr,
        uint256 value,
        bytes memory data,
        Operation inputOP
    ) internal view {
        if (data.length < 4) {
            revert FunctionSignatureTooShort();
        }

        ScopedContract storage scopedContract = role.contracts[targetAddr];
        if (scopedContract.scope == Scope.Contract) {
            _checkOP(value, inputOP, scopedContract.op);
            return;
        } else if (scopedContract.scope == Scope.Function) {
            uint256 funcScopedFlag = role.functions[
                _key4Func(targetAddr, bytes4(data))
            ];

            if (funcScopedFlag == 0) {
                revert FunctionNotAllowed();
            }

            (Operation scopedFuncOP, bool isBypass, ) = ScopedFlag.unpackLeft(
                funcScopedFlag
            );

            _checkOP(value, inputOP, scopedFuncOP);

            if (isBypass != true) {
                _checkParameters(role, funcScopedFlag, targetAddr, data);
            }

            return;
        }

        revert TargetAddressNotAllowed();
    }

    function _checkParameters(
        Role storage role,
        uint256 funcScopedFlag,
        address targetAddr,
        bytes memory data
    ) internal view {
        bytes4 funcSig = bytes4(data);
        (, , uint256 argsCount) = ScopedFlag.unpackLeft(funcScopedFlag);

        for (uint256 i = 0; i < argsCount; ++i) {
            (bool isScoped, ParameterType paramType, Comparison cp) = ScopedFlag
                .unpackRight(funcScopedFlag, i);

            if (!isScoped) {
                continue;
            }

            bytes32 inputValue;
            if (paramType != ParameterType.Static) {
                inputValue = _pluckDynamicValue(data, paramType, i);
            } else {
                inputValue = _pluckStaticValue(data, i);
            }

            bytes32 key = _key4FuncArg(targetAddr, funcSig, i);
            _compare(cp, role.expectedValues[key], inputValue);
        }
    }

    function _compare(
        Comparison cp,
        bytes32 expectedValue,
        bytes32 inputValue
    ) internal pure {
        if (cp == Comparison.Eq && inputValue != expectedValue) {
            revert ParameterNotEqualToExpected();
        } else if (cp == Comparison.Gt && inputValue <= expectedValue) {
            // todo should convert to int or uint ?
            revert ParameterNotGreaterThanExpected();
        } else if (cp == Comparison.Gte && inputValue < expectedValue) {
            revert ParameterNotGreaterThanEqualToExpected();
        } else if (cp == Comparison.Lt && inputValue >= expectedValue) {
            revert ParameterNotLessThanExpected();
        } else if (cp == Comparison.Lte && inputValue > expectedValue) {
            revert ParameterNotLessThanEqualToExpected();
        }
    }

    function _checkOP(
        uint256 value,
        Operation inputOP,
        Operation scopedOP
    ) internal pure {
        if (scopedOP == Operation.None) {
            revert OperationNotAllow();
        } else if (inputOP == Operation.Both || inputOP == Operation.None) {
            revert InputOperationUnclear();
        } else if (inputOP == Operation.Send) {
            // isSend && !canSend
            if (
                value > 0 &&
                scopedOP != Operation.Send &&
                scopedOP != Operation.Both
            ) {
                revert SendNotAllowed();
            }
        } else {
            // isDelegateCall && !canDelegateCall
            if (
                scopedOP != Operation.DelegateCall && scopedOP != Operation.Both
            ) {
                revert DelegateCallNotAllowed();
            }
        }
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
        uint16 roleId,
        address targetAddr,
        Operation op
    ) external {
        role.contracts[targetAddr] = ScopedContract(Scope.Contract, op);
        emit AllowContract(roleId, targetAddr, op);
    }

    function revokeContract(
        Role storage role,
        uint16 roleId,
        address targetAddr
    ) external {
        role.contracts[targetAddr] = ScopedContract(Scope.None, Operation.None);
        emit RevokeContract(roleId, targetAddr);
    }

    function allowFunction(
        Role storage role,
        uint16 roleId,
        address targetAddr,
        bytes4 funcSig,
        Operation op
    ) external {
        uint256 funcScopedFlag = ScopedFlag.packLeft(0, op, true, 0);
        role.functions[_key4Func(targetAddr, funcSig)] = funcScopedFlag;

        emit AllowFunction(roleId, targetAddr, funcSig, op, funcScopedFlag);
    }

    function revokeFunction(
        Role storage role,
        uint16 roleId,
        address targetAddr,
        bytes4 funcSig
    ) external {
        role.functions[_key4Func(targetAddr, funcSig)] = 0;
        emit RevokeFunction(roleId, targetAddr, funcSig, 0);
    }

    function allowFunctionWithParameter(
        Role storage role,
        uint16 roleId,
        address targetAddr,
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

        uint256 funcScopedFlag = ScopedFlag.packLeft(0, op, false, argsCount);

        for (uint256 i = 0; i < argsCount; ++i) {
            funcScopedFlag = ScopedFlag.packRight(
                funcScopedFlag,
                i,
                isScopeds[i],
                paramTypes[i],
                cps[i]
            );
        }

        role.functions[_key4Func(targetAddr, funcSig)] = funcScopedFlag;

        for (uint256 i = 0; i < argsCount; ++i) {
            role.expectedValues[
                _key4FuncArg(targetAddr, funcSig, i)
            ] = _compressExpectedValue(paramTypes[i], expectedValues[i]);
        }

        emit AllowFunctionWithParameter(
            roleId,
            targetAddr,
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
        if ((paramType != ParameterType.Static) && (cp != Comparison.Eq)) {
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
            paramType == ParameterType.Dynamic32 &&
            expectedValue.length % 32 != 0
        ) {
            revert UnsuitableDynamic32ExpectedValueSize();
        }
    }
}

library ScopedFlag {
    // LEFT SIDE
    // 2   bits -> options
    // 1   bits -> isBypass
    // 5   bits -> unused
    // 8   bits -> length
    function packLeft(
        uint256 scopedFlag,
        Operation op,
        bool isBypass,
        uint256 length
    ) public pure returns (uint256) {
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

    function unpackLeft(uint256 scopedFlag)
        public
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
    function packRight(
        uint256 scopedFlag,
        uint256 index,
        bool isScoped,
        ParameterType paramType,
        Comparison paramComp
    ) public pure returns (uint256) {
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

    function unpackRight(uint256 scopedFlag, uint256 index)
        public
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
        paramType = ParameterType(
            (scopedFlag & paramTypeMask) >> (index * 2 + 96)
        );
        cp = Comparison((scopedFlag & paramCompMask) >> (index * 2));
    }
}
