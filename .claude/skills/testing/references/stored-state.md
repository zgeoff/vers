# Stored state

Check stored state through its owner. Stored state means database rows and files on disk. The owner
is the module whose code writes them.

- The owner's own tests read its rows and files directly.
- Every other test reads them only through the owner's code: a read function for rows, a path helper
  for files. It never writes its own query and never builds a stored path by hand.
- If the unit under test already returns the fact, check its result. Use the owner's code only when
  the result does not hold the fact.
- If the owner has no read function for the fact, add one to the owner, with its own test.
- A query that only sets up a failure, such as a trigger that makes a write fail, is setup, not a
  check. It stays.

`src/notes/store/` writes the `notes` table and the attachment files, so it owns both. A handler
test outside the store checks the result of an archive.

```ts
// before: the test writes its own query and builds the path by hand
const row = await ctx.db
  .selectFrom('notes')
  .select('archived_at')
  .where('id', '=', note.id)
  .executeTakeFirstOrThrow();

expect(row.archived_at).toBeValidDate();
expect(existsSync(join(ctx.dataDir, 'archive', note.id, 'list.txt'))).toBe(true);

// after: the test reads through the store's read function and path helper
const archived = await readNote(ctx.db, note.id);

expect(archived?.archivedAt).toBeValidDate();
expect(existsSync(buildArchivePath(ctx.dataDir, note.id, 'list.txt'))).toBe(true);
```

The store's own test, `src/notes/store/read-note.test.ts`, still inserts and queries `notes`
directly, because the table is what it checks.

With Kysely, the owner's test reads a row that must exist with `executeTakeFirstOrThrow()`, with the
selection narrowed to the one column under test when only that column matters, and asserts absence
with `executeTakeFirst()` and `toBeUndefined()`.

## Seeding stored state

A test seeds stored state with direct inserts and [factories](./factories.md) by default. A seeding
helper is a [composite](./factories.md#composites): it lives in the repo's shared test utils with
its own tests, takes a name the system already uses, and writes the whole effect behind that name,
such as the row and the files of one image.

A store with no service layer seeds through its own write functions, never through raw SQL. A direct
write that no write function can make stays, with the `//` comment that names the case, as
[Persisted test data](./database.md#persisted-test-data) asks.

A repo's `project-testing` skill lists the concepts that seed only through a composite, and an agent
follows that list. The repo's maintainer designs the first seeding pattern in each repo before
anyone builds one. An agent can then add composites that follow that pattern.

## Exceptions to checking through the owner

Three kinds of test outside the owner read and write stored state directly, and no others:

- A migration test reads and writes tables directly.
- The own test of a composite or a seeding helper checks the rows and files that it writes.
- A test of code whose product is SQL or storage, such as a database dialect or a database tool,
  uses tables as its test input.

Tests under `integration/` and `e2e/` get no exception. A case off this list changes this shared
skill, never a project skill. A project skill tightens the rule in two ways only: the seeding list,
and a named owner for a table that several modules write. It never adds an exception.
