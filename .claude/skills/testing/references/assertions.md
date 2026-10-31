# Assertions

- Use `toStrictEqual` when the test determines every field of the expected value: the full shape is
  the contract. When the value carries fields that the test does not determine, such as faker
  defaults, timestamps, or generated ids, use asymmetric matchers inside `toStrictEqual`, or
  `toMatchObject`. Choosing a partial match because the full literal is long is a defect. `toEqual`
  never appears.
- Assert each result on its own. Never assemble unrelated results or observations into an object
  only to put them under one `toStrictEqual`. A normalized projection of one result, such as a
  command's exit code, stdout, and stderr, stays together. A later request's status is a separate
  assertion. Independently meaningful scalar checks use separate `toBe` calls.
- Derive an expected value from the contract, independently of the unit's own calculation. For a
  filesystem path, use a known package or fixture root plus the explicit expected location, rather
  than repeating the unit's relative path expression. Keep a behaviour check where it proves the
  derived value works.
- A recovery test injects one or more faults and then acts to recover. The recovery is its one act,
  and each faulted call is arrangement. During arrangement, capture the earlier state and each
  faulted call's rejection as values, the rejection with
  `.then(() => null, (error: unknown) => error)`. Assert every captured value at the end beside the
  final state, with a separate assertion for each.
- After a mutation, one `toBe` on the field that changed is enough.
- Snapshots are inline only. `toMatchInlineSnapshot` pins a golden value: deterministic machine
  output that no person derives by reading the code, such as a generated SQL string or a rendered
  report. A value a person wrote by hand, such as a spec test vector, keeps an explicit matcher,
  because a snapshot of it would bless whatever the code produced. File snapshots and component
  snapshots never appear, and `zgeoff/no-file-snapshot` reports a file snapshot.
- A deterministic pipeline's suite opens with two tests. A frozen-golden test feeds one hand-written
  literal input and pins the full output inline. A determinism test asserts that the same input
  gives equal outputs: `expect(run(input)).toStrictEqual(run(input))`. The golden input is never a
  factory call, because regenerating snapshots must never change the input.
- When the repo commits a file that it generates, such as an OpenAPI document, the frozen-golden
  test compares the regenerated output with that committed file instead of an inline snapshot. That
  file is a product of the repo, not a file snapshot.
- A stand-in's derived values, such as a fake hash or a fake signature, are not contract. Assert
  their properties: their shape, that the same input gives the same output, and that different
  inputs give different outputs.
- A sweep that deletes resources has a test that names what it never touches, such as
  `it never removes another owner's files`.

## Narrowing and branching

An ordinary test body never branches. Each path through the unit gets its own test. Generated
operation dispatch follows [Property tests](../SKILL.md#property-tests).

Narrow a value that may be missing with `invariant(value)` or an explicit `throw` on the line before
the assertion. Optional chaining inside `expect` is safe when the matcher fails on `undefined`,
because a missing value then fails loudly:

```ts
expect(result.data?.title).toBe('groceries');
```

Four matchers pass on `undefined`: a `.not` matcher, `toBeUndefined`, `toBeFalsy`, and `toBeNil`.
With those, `?.` or `??` turns a missing value into a pass, so narrow first:

```ts
invariant(result.data);
expect(result.data.error).toBeUndefined();
```

When you are unsure which kind a matcher is, narrow.

An assertion inside an ordinary callback passes when the callback never runs. Copy the value out of
the callback into a variable, then assert on it once the call returns. Property-runner assertions
follow [Property tests](../SKILL.md#property-tests).
