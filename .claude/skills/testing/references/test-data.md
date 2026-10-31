# Test data

- Plain inputs stay inline at the call site: arguments, options bags, config values. Write the
  literal again in the next test. A module-level fixture, a baseline object shared between tests, or
  a constant that only names a literal (`const EMPTY = ''`) never appears in a test file.
- A domain type that crosses a module boundary gets a tested factory in the shared test utils as
  soon as a test needs one, and a domain concept built from several records gets a composite. A type
  that another package owns, such as an SDK result, crosses a boundary on its first use. A type
  private to the module under test stays an inline literal.
  [Factories and composites](./factories.md) holds how to name and write a factory or a composite.
- A stand-in's data stays inline in the test: a fixed answer, a recorder (`mock()`), including one
  that parses the input it records, a no-op (`() => {}`), an answer table read by one key, or a list
  of scripted answers that the test passes to the tested answer-queue util. Any other code in a
  stand-in is logic, such as consuming answers in order, counting calls, keeping state, branching,
  waiting, or deriving a value from an argument. It moves to a tested util in the shared test utils,
  and so does a gate, delay, or counter wrapped around a tested stand-in. The test passes its
  answers to that util inline.
- A stand-in util lives in the shared test utils under a name for what it impersonates. Its prefix
  follows the repo's function-naming table. A stand-in that starts something long-running, such as a
  stub server, is `start-stub-<thing>.ts`. A stand-in that creates a resource, such as a stub
  repository on disk, is `create-stub-<thing>.ts`. Every other stand-in is `build-stub-<thing>.ts`.
  It has its own tests, which pin the assumptions it makes about the real thing. An executable
  stand-in script uses `run-stub-<thing>.ts`; an imported helper that starts it keeps
  `start-stub-<thing>.ts`.
- Never add a test whose only purpose is to check that the mocking library records calls. A no-op
  executable placeholder stays inline through the shared file helper when the test needs only an
  executable. Extract a dedicated stand-in when the script models arguments, output, or failures.
- A chain of `mockReturnValueOnce` or `mockResolvedValueOnce` calls never appears: a call past the
  last answer returns the default without failing, where the answer-queue util throws.
