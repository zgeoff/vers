# Database testing

A package that owns a schema tests against the real engine: Postgres for a Postgres package, SQLite
for a SQLite package. An engine reimplemented in JavaScript, such as `pg-mem`, never stands in,
because SQL errors, constraint violations, migration mistakes, and query-builder edge cases are the
defects these tests exist to catch. An in-memory SQLite database (`:memory:`) is the real engine,
not a reimplementation. Each test gets a database that no other test can see, and the
[testing skill](../SKILL.md) rules on `setupTest`, cleanup, and data apply throughout.

## Postgres isolation

Each test acquires a handle from the repo's test-database util, holds it in `setupTest()`, and
injects the handle's connection into the code under test. Code that opens its own connection escapes
the isolation, so thread the handle's connection through instead. The schema is built once per run,
from the migrations or from a schema dump, and the util names which.

The handle offers three isolation levels:

| Level         | Mechanism                                        | Use it when                                                                                                      |
| ------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `transaction` | One transaction per test, rolled back on dispose | The default for every suite                                                                                      |
| `schema`      | A committed copy of the schema per test          | The code commits during the operation, or carries on after a constraint violation it caught                      |
| `database`    | A committed copy of the database per test        | The code uses database-wide state: advisory locks, `LISTEN`/`NOTIFY`, DDL and migration runs, partitioned tables |

**Why the opt-outs exist:** a rolled-back transaction cannot nest a second interactive transaction,
and one failed statement aborts the whole shared transaction, so every later query in the test
fails. A suite that opts out of `transaction` carries a comment that names the code that requires
it, such as `// claimJob commits the claim before it runs the job`.

## SQLite isolation

A fresh SQLite database per test costs little, so SQLite needs no isolation levels. `setupTest()`
opens the database and its dispose closes it.

- Open a file inside the test's `mkdtemp` tree when the code opens its own connection by path, or
  when the test depends on file behaviour such as a read-only connection or write-ahead logging.
- Open `:memory:` when the code receives an injected handle.

## Booting a service

A service exposes one factory, such as `createNotesService({ db })`, that the production entrypoint
and every test both call. Tests inject only the database. A test never copies the service's
configuration into its own setup, because a copy drifts from production.

`setupTest()` builds the database handle and boots the service through that factory. It may write
the boot data the service refuses to start without, under the boot-data rule in the
[testing skill](../SKILL.md#setuptest).

## Persisted test data

A composite or persistence helper writes rows, and it takes its defaults from the matching
plain-data factory, so defaults live in one place. A row composite's doc comment names the scenario
that the service's own operations cannot reach, such as another user's rows, a back-dated
`createdAt`, or a known one-time-password secret. That comment is the test of whether a direct write
belongs in the composite at all. A composite that cannot name one should be a call to the service. A
composite's own test asserts the persisted row with `toMatchObject`, because the database computes
some of its fields, and asserts that overrides apply.

## Reading results back

With Kysely, read back a row that must exist with `executeTakeFirstOrThrow()`, narrowing the
selection to the one column under test when only that column matters. Assert absence with
`executeTakeFirst()` and `toBeUndefined()`.

```ts
const row = await ctx.db
  .selectFrom('notes')
  .select('archivedAt')
  .where('id', '=', note.id)
  .executeTakeFirstOrThrow();

expect(row.archivedAt).toBeValidDate();
```

When a later query in the same test must see a rejected call's transaction settle, settle the call
first, then assert on it:

```ts
const request = ctx.client.archiveNote({ noteID: 'missing' });

await request.catch(() => {});

expect(request).rejects.toMatchObject({ code: 'NOT_FOUND' });
```

## Timestamps and order

Under `transaction` isolation, Postgres pins `now()` to the start of the transaction, so every
timestamp the database defaults within one test is identical. Timestamps that a factory defaults
from the JavaScript clock collide at millisecond resolution. A test that asserts an order, or a
winner, among rows whose sort keys tie passes explicit, distinct timestamps.

A production query ordered by a timestamp carries a total-order tiebreaker, such as
`.orderBy('createdAt', 'desc').orderBy('id', 'desc')`, when its callers need a stable result. The
tie gets its own test, with two rows that share the timestamp.

## Access rules

Each actor in an access test comes from a composite and holds its own client. The pair of tests from
the [testing skill](../SKILL.md#authorisation-pairs) applies: the owner succeeds, and the other
actor is refused or sees nothing.

## Configuration stored in the database

A service that reads its configuration from a table resolves it with a real query. Seed the rows and
let the real resolution run. Never stub the configuration read, because the resolution, such as the
most specific matching row winning, is the behaviour under test.

## SQL built from identifiers

A utility that interpolates an identifier, such as a table or column name, into SQL has a guard
against unsafe names, and the guard has its own rejection test.
