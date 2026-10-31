# Matchers

The `@zgeoff/bun-test-extended` preload registers the jest-extended matchers, and a package's
`augment-bun-test.ts` import gives `tsc` their types. Typecheck fails on a matcher name that does
not exist. When a matcher in this table checks the property a test asserts, use it in place of a
hand-written check such as `expect(items.every(isOpen)).toBe(true)`, because the matcher reports the
received value on failure and the hand-written check reports only `false`:

| Value             | Matchers                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Array             | `toIncludeAllMembers`, `toIncludeSameMembers`, `toIncludeAllPartialMembers`, `toPartiallyContain`, `toSatisfyAll` |
| Object            | `toContainEntry`, `toContainEntries`, `toContainAllKeys`, `toBeFrozen`                                            |
| String            | `toStartWith`, `toEndWith`, `toInclude`, `toEqualCaseInsensitive`, `toEqualIgnoringWhitespace`                    |
| Any value         | `toBeNil`, `toBeOneOf`, `toSatisfy`, `toBeWithin`, `toBeEmpty`                                                    |
| Date              | `toBeAfter`, `toBeBefore`, `toBeBetween`, `toBeValidDate`                                                         |
| Mock              | `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveBeenCalledBefore`, `toHaveBeenCalledAfter`      |
| Error and promise | `toThrowWithMessage`, `toResolve`, `toReject`                                                                     |

Each matcher also works asymmetrically inside `toStrictEqual` and `toMatchObject`, as in
`status: expect.toBeOneOf(['open', 'held'])`. Upstream leaves `expect.pass` and `expect.fail`
unimplemented, so the types leave them out.

`toPartiallyContain` and `toIncludeAllPartialMembers` take plain objects, such as
`toPartiallyContain({ path: ['title'] })`, and never a bare asymmetric matcher as an element. They
compare the expected element's own fields with each received element, and a Bun matcher such as
`expect.toStartWith('zzz')` or `expect.objectContaining({ id: 2 })` has no own fields, so any
non-empty array passes. A matcher inside a field is checked, as in
`toPartiallyContain({ name: expect.toStartWith('a') })`. To find an element by a matcher, use
`toContainEqual`, which applies the matcher to each element:
`expect(names).toContainEqual(expect.toStartWith('a'))`.
