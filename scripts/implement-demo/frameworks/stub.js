// Placeholder adapter used by frameworks whose full template set is not yet
// implemented. Returns a clear "not yet supported" stub instead of silently
// emitting empty files. Lets the orchestrator complete the spec validation
// and domain generation (types + seeds, which ARE framework-agnostic) so
// the caller still gets useful artifacts.

export function makeStub(framework) {
  function notSupported() {
    return [];
  }
  return {
    FRAMEWORK: framework,
    generateStores: notSupported,
    generatePages: notSupported,
    generateRouter: notSupported,
    notSupportedMessage:
      `Framework "${framework}" — store/page/router generation is not yet implemented in implement-demo. ` +
      `Types + seeds were generated (they are framework-agnostic). ` +
      `Wire the stores and pages manually following the pattern in examples/${framework}-directory-bonita/, ` +
      `or contribute the adapter at scripts/implement-demo/frameworks/${framework}.js.`,
  };
}
