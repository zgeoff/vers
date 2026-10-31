# Loops

A loop that runs an assertion once per input hides which input failed, and its first failure stops
the rest. Replace it with `test.each`, or write each case as its own test. A loop of `expect` calls
over the items of one result becomes one collection matcher, which reports the whole collection on
failure:

```ts
expect(listOpenNotes(store)).toSatisfyAll((note: Note) => note.archivedAt === null);
```

Two loops that check a set the module owns stay legal:

- A completeness loop that walks a module's own registry, such as checking that every exported
  renderer has a preview.
- A conformance loop that drives each generated case through
  `await expect(conformanceCase.run(app)).toResolve()`.

Neither loop may compute its expectation with the same transformation it checks. A loop that only
arranges, such as inserting 51 rows to cross a page limit, holds no assertion and stays legal. When
the order of the rows does not matter, insert them with
`await Promise.all(Array.from({ length: 51 }, …))`. When it does, insert them one at a time in the
loop.
