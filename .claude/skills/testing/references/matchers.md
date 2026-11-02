# Matchers

Use a jest-extended matcher in place of a hand-written check, so a failure prints the received
value. Pick one by the kind of value it checks. The matchers come from `@zgeoff/bun-test-extended`.
When a matcher throws `TypeError` at run time, list that package first in the `preload` array of
`bunfig.toml`. When `tsc` doesn't know a matcher, add the package to `compilerOptions.types` in
`tsconfig.json`.

| Value             | Matchers                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Array             | `toIncludeAllMembers`, `toIncludeSameMembers`, `toIncludeAllPartialMembers`, `toPartiallyContain`, `toSatisfyAll` |
| Object            | `toContainEntry`, `toContainEntries`, `toContainAllKeys`, `toBeFrozen`                                            |
| String            | `toStartWith`, `toEndWith`, `toInclude`, `toEqualCaseInsensitive`, `toEqualIgnoringWhitespace`                    |
| Any value         | `toBeNil`, `toBeOneOf`, `toSatisfy`, `toBeWithin`, `toBeEmpty`                                                    |
| Date              | `toBeAfter`, `toBeBefore`, `toBeBetween`, `toBeValidDate`                                                         |
| Mock              | `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveBeenCalledBefore`, `toHaveBeenCalledAfter`      |
| Error and promise | `toThrowWithMessage`, `toResolve`, `toReject`                                                                     |

- Use any of them inside `toStrictEqual`: `status: expect.toBeOneOf(['open', 'held'])`.
- `toPartiallyContain` and `toIncludeAllPartialMembers` take plain objects, never a bare asymmetric
  matcher, which matches any non-empty array. To find an element by a matcher, use
  `toContainEqual(expect.toStartWith('a'))`.
