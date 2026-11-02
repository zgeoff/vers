# Database testing

Test a package that owns tables, through its migrations or its queries, against the real engine:
Postgres for a Postgres package, SQLite for a SQLite package. Never use an engine reimplemented in
JavaScript, such as `pg-mem`. SQL errors, constraint violations, migration mistakes and
query-builder edge cases are the defects these tests catch, and a reimplementation misses them. An
in-memory SQLite database (`:memory:`) is the real engine.

Give each test a database whose rows no other test sees, and pass its connection into the code under
test. When the code opens its own connection, it reaches a database the test doesn't isolate. Follow
the testing skill's rules on [setupTest](../SKILL.md#setuptest), [Cleanup](../SKILL.md#cleanup) and
[Test data](../SKILL.md#test-data) here too.

- [Postgres isolation](#postgres-isolation)
- [SQLite isolation](#sqlite-isolation)
- [Booting a service](#booting-a-service)
- [Persisted test data](#persisted-test-data)
- [Reading results back](#reading-results-back)
- [Timestamps and order](#timestamps-and-order)
- [Access rules](#access-rules)
- [Configuration stored in the database](#configuration-stored-in-the-database)
- [SQL built from identifiers](#sql-built-from-identifiers)

## Postgres isolation

In `setupTest()`, get a handle from the repo's test-database helper in `test-utils/`, and pass the
handle's connection to the code under test. The helper builds the schema once per run as a template,
as [Per-run templates](./slow-tests.md#per-run-templates) describes. Never drop its databases
yourself: the sweep at the start of each run removes the ones that earlier runs left.

Pick one isolation level for each test file, and pass it to the helper:

- Use `transaction` by default. Each test runs in one transaction on its worker's copy of the
  template, and the helper rolls it back after the test.
- Use `clone` when the code does one of these. Each test then gets its own copy of the template,
  which the helper drops after the test:
  - commits;
  - opens a transaction of its own, which can't run inside the test's transaction;
  - carries on after a constraint violation it caught, since one failed statement aborts the test's
    transaction and every later query in it fails;
  - uses database-wide state, such as advisory locks, `LISTEN`/`NOTIFY` or DDL statements;
  - opens its own connection, which you point at the clone.

In a file that uses `clone`, add a comment that names the code that needs it, such as
`// claimJob commits the claim before it runs the job`.

## SQLite isolation

Give each test a copy of a migrated template file. A fresh database pays for every migration in
every test.

The test-database helper migrates the template once per run. Before any test copies the template,
the helper closes it or checkpoints its write-ahead log. A copy of the main file alone misses the
changes that are still in the log, migrations included. When you write such a helper, do the same.

Choose how the test gets its copy:

- When the code opens its own connection by path, or the test depends on file behaviour, such as a
  read-only connection or write-ahead logging, copy the file into the test's `mkdtemp` tree.
- When the code takes the database handle as an argument, load the template's bytes into an
  in-memory database with `Database.deserialize` from `bun:sqlite`.

Open SQLite with `synchronous = off` in the helper. A test never needs its writes to survive a power
loss, and a sync on each commit costs time. In a test of what survives a crash, use production's
setting.

## Booting a service

Give a service one function that builds it, such as `createNotesService({ db })`, and call it from
the production entrypoint and from every test. In a test, pass in only the I/O the testing skill's
[Boundaries](../SKILL.md#boundaries) lets you replace, such as the database and the clock. Never
copy the service's configuration into a test's setup, because a copy drifts from production.

In `setupTest()`, build the database handle and boot the service through that function. Create no
data there, as in the [testing skill](../SKILL.md#setuptest). When a service refuses to start until
its data exists, boot it in the test body, after the test creates that data.

## Persisted test data

Outside the module that writes the table, seed rows through that module's seeds, never with your own
insert, as in [Stored state](../SKILL.md#stored-state). To write a seed, see
[Seeding](./seeding.md).

## Reading results back

Outside the module that writes the table, read a row back through that module's read function, as in
[Stored state](../SKILL.md#stored-state). In the module's own test, query its table directly. With
Kysely, read a row that must exist with `executeTakeFirstOrThrow()`, and select only the column
under test when only that column matters. Assert absence with `executeTakeFirst()` and
`toBeUndefined()`.

```ts
// archive-note.test.ts, in the module that writes the notes table
await archiveNote(ctx.db, note.id, ctx.clock.now());

const row = await ctx.db
  .selectFrom('notes')
  .select('archived_at')
  .where('id', '=', note.id)
  .executeTakeFirstOrThrow();

expect(row.archived_at).toBeValidDate();
```

A rejected call can still be rolling back its transaction when the test moves on. When the test
reads the database after a call it expects to reject, settle the call with `.catch()` first, then
assert the rejection with the rules in the testing skill's [Errors](../SKILL.md#errors), then read:

```ts
const request = ctx.service.archiveNote({ noteID: 'missing' });

await request.catch(() => {});

expect(request).rejects.toMatchObject({ code: 'NOT_FOUND' });

const row = await ctx.db.selectFrom('notes').selectAll().executeTakeFirst();

expect(row).toBeUndefined();
```

In a test of how code recovers after several calls fail, capture each rejection as a value instead,
as the testing skill's [Assertions](../SKILL.md#assertions) describe.

## Timestamps and order

Pass explicit, distinct timestamps when a test asserts an order, or a winner, among rows. Timestamps
that a `buildMock<Type>` factory fills from the JavaScript clock can share a millisecond. Under
`transaction` isolation, Postgres also pins `now()` to the start of the transaction, so every
timestamp the database fills in within one test is the same.

When callers of a production query ordered by a timestamp need a stable result, add a tiebreaker to
the query that gives a total order, such as `.orderBy('created_at', 'desc').orderBy('id', 'desc')`.
Give the tie its own test, with two rows that share the timestamp.

## Access rules

In an access test, seed each user or role the rule names. In the test body, build the client each
one calls through, such as an API client signed in as that user, or a connection as that Postgres
role. Then write the tests that the [testing skill](../SKILL.md#access-rules) asks for: the allowed
user succeeds, and the other is refused or sees nothing.

## Configuration stored in the database

When a service reads its configuration from a table, seed the configuration rows through the seeds
of the module that writes the table, and let the real query pick the row that applies. Never stub
the configuration read. Which row wins, such as the most specific match, is the behaviour under
test.

## SQL built from identifiers

When a utility puts an identifier, such as a table or column name, into SQL, make it check the name
against the list of names the code expects. Give that check its own test, with a name outside the
list.
