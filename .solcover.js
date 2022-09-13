module.exports = {
  skipFiles: [
    "test/TestContract.sol",
    "test/TestPluckParam.sol",
    "test/TestSafeProxy.sol",
    "Context.sol",
    "GnosisSafe.sol",
  ],
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
}
