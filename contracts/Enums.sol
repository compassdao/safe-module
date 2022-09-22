// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.6;

enum ParameterType {
  Static,
  Dynamic,
  Dynamic32
}
enum Comparison {
  Eq,
  Gt,
  Lt
}

enum Scope {
  None,
  Contract,
  Function
}

enum Operation {
  None,
  Call,
  DelegateCall,
  Both
}

enum PermitSettledResult {
  Unknown,
  Fulfilled,
  ContractScopeRejected,
  FunctionScopeRejected,
  ParametersScopeRejected,
  OperationRejected
}
