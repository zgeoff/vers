# Seeding

Seed through the module that writes the state: put rows or files in place for a test by calling that
module's own functions. Keep the seeds in the `src/test-utils/` folder of the module's package, and
export them so other packages' tests can import them. When every test outside the module seeds
through it, a schema or layout change breaks only the module and its tests.

- [The seeds a module publishes](#the-seeds-a-module-publishes)
- [Writing a seed](#writing-a-seed)
- [Publishing seeds](#publishing-seeds)
- [`buildSeeder` and `setupTest`](#buildseeder-and-setuptest)
- [Calls that stay in the test](#calls-that-stay-in-the-test)
- [Table-driven tests](#table-driven-tests)
- [A state no code in the module makes](#a-state-no-code-in-the-module-makes)
- [Interrupted operations](#interrupted-operations)
- [A seed's own test](#a-seeds-own-test)

Write seeds this way even in a repo whose older tests still write rows themselves, such as with
Kysely's `insertInto`. When you change a module, move its tests onto seeds, and leave other tests as
they are.

- Never branch on a state in a seed, such as a `seedNote` that reads `input.status` and archives the
  note when it is `'archived'`. The branch copies the module's state machine, and the copy goes
  wrong when the module changes. Write one seed per state, each a straight line of calls.
- Never write a seed for a bundle of records, such as `seedUserWithTwoNotes`, because it hides the
  scenario. Call `ctx.seed.user` and `ctx.seed.note` in the test, and pass the user's ID into the
  note's input.
- Never write rows or files directly because the module doesn't export its write function. Export
  the function from the module. An awkward import or a slow call is no reason either.

Write directly only in these places, and never in `e2e/`:

- inside a seed, for a state that no code in the module makes, as in
  [A state no code in the module makes](#a-state-no-code-in-the-module-makes);
- in the module's own tests, when no seed makes the state;
- in a migration test, and in a test of code whose product is SQL or storage, such as a database
  dialect.

You may also run a query that only sets up a failure, such as a trigger that makes a write fail.

## The seeds a module publishes

Start from the module's state type, such as `type NoteStatus = 'draft' | 'archived'`.

- Write the base seed, `seedNote`, to make the record in the state that the module's create function
  gives it, here `draft`.
- Write one more seed for each other value of the state type, here `seedArchivedNote`.
- Give a kind of record with no state type only its base seed. When the module has a status column
  but no union type, treat each value that the module's code writes to the column as a state.
- Pass every other difference, such as a title or a timestamp, as input to a seed. Never write a new
  seed for it.

Write no seed beyond that list, except one for a state that no code in the module makes.

## Writing a seed

Put each seed in its own file in the package's `src/test-utils/`: `seed-note.ts` exports `seedNote`,
and `seed-archived-note.ts` exports `seedArchivedNote`. Start a function name with `seed` only in
`src/test-utils/`.

Give a seed two arguments:

- the module's deps, the handles its code already takes, such as `{ db, clock }`;
- a partial of the input type of the module's create function, such as `Partial<NewNote>`. Fill it
  out with the type's `buildMock<Type>` factory. When the factory is missing, write it first, as
  [Test data](../SKILL.md#test-data) in the testing skill describes.

Inside the seed, call the module's write functions in a straight line:

- In the base seed, call the module's create function.
- In a variant, call the base seed, then the shortest chain of the module's transition functions
  that reaches the state: `seedArchivedNote` calls `seedNote`, then `archiveNote`.
- When a transition takes an argument that the create input lacks, such as a cancel reason, pass a
  fixed value in the seed. When a test checks that argument, call the transition in the test.
- When a write function returns a wider type than the seed promises, narrow it with `invariant()`
  from `tiny-invariant`, as `seedNote` does below. When the module changes what the function
  returns, the seed then throws, and never hands a test a record in the wrong state.
- Take the time from `deps.clock`. When a test needs a fixed timestamp, pass it in the input if the
  create input has the field. Otherwise move the clock in the test before you call the seed. When a
  test needs two different timestamps, such as a creation time and an archive time, make the calls
  in the test.

```ts
// seed-note.ts
export async function seedNote(deps: NotesDeps, input: Partial<NewNote> = {}): Promise<DraftNote> {
  const note = await createNote(deps.db, buildMockNewNote(input), deps.clock.now());

  invariant(note.status === 'draft');

  return note;
}

// seed-archived-note.ts
export async function seedArchivedNote(
  deps: NotesDeps,
  input: Partial<NewNote> = {},
): Promise<ArchivedNote> {
  const note = await seedNote(deps, input);

  return archiveNote(deps.db, note.id, deps.clock.now());
}
```

`archiveNote` already returns `ArchivedNote`, so the variant needs no `invariant()`.

When a write sits inside a larger function, such as a request handler, move it into its own function
in the module. Call that function from both the handler and the seed.

## Publishing seeds

Export the package's `src/test-utils/` folder in the `exports` of its `package.json`, such as
`"./test-utils/*": "./src/test-utils/*.ts"`. Another package then imports
`<package>/test-utils/seed-note`.

For each module, also export one function that binds the module's seeds to its deps. Name it for the
record, such as `buildNoteSeeder` in `build-note-seeder.ts`:

```ts
export const buildNoteSeeder = (deps: NotesDeps) => ({
  note: (input?: Partial<NewNote>) => seedNote(deps, input),
  archivedNote: (input?: Partial<NewNote>) => seedArchivedNote(deps, input),
});
```

Name each key for the seed without `seed`, so a test calls `ctx.seed.archivedNote(…)`. Only one
module stores each kind of record, so two modules never publish the same key.

## `buildSeeder` and `setupTest`

When a package's tests seed, give the package one `buildSeeder(deps)` in `build-seeder.ts` in its
`src/test-utils/`. Spread into it the `build<Record>Seeder` of each module whose state those tests
need. Write no test for it, because TypeScript checks it:

```ts
export const buildSeeder = (deps: TestDeps) => ({
  ...buildNoteSeeder(deps),
  ...buildAttachmentSeeder(deps),
});
```

Declare `TestDeps` in `build-seeder.ts`, as the handles that each `build<Record>Seeder` needs. Wire
all of them in each `setupTest()` that calls `buildSeeder`. When a `build<Record>Seeder` needs a
handle that `TestDeps` lacks, TypeScript fails, so add the handle to `TestDeps` and to the wiring.

Return the deps and the seeds from each of those `setupTest()` functions:
`return { ...deps, seed: buildSeeder(deps) }`. Binding the seeds is wiring, so `setupTest()` still
creates no data. A test then calls its seeds through `ctx.seed`.

- When a test uses two databases, put both handles in `TestDeps`. Pass each `build<Record>Seeder`
  the part it needs, such as `buildAuditSeeder({ db: deps.auditDB, clock: deps.clock })`. The test
  still calls one `ctx.seed`.
- When a test uses two hosts, such as a sync test with a source and a target, call `buildSeeder`
  once for each host's deps: `source: { ...sourceDeps, seed: buildSeeder(sourceDeps) }`. The test
  then calls `ctx.source.seed.note(…)` and `ctx.target.seed.note(…)`.

## Calls that stay in the test

Use a seed only to put state in place. Make these calls in the test body, where the reader sees
them:

- the call under test, through the unit's entry;
- each clock move;
- each call whose effect on another record the test checks. For example, when stopping a job also
  cancels the job's open tasks, and the test checks the tasks, stop the job in the test. Then assert
  that effect in the test.

Never call `expect` inside a seed. The `invariant()` on a write function's result is the one check a
seed makes.

When the test checks what a transition does, make the transition a real call in the test. For
example, a test of what archiving does to a note's search entry calls `seedNote`, then
`archiveNote`, and never calls `seedArchivedNote`. Use a seed when the test only needs the record to
be in a state.

## Table-driven tests

In a test over several states, put the unbound seed functions in the rows, and pass `ctx` to each.
`ctx` holds the deps, because `setupTest()` spreads them into it. In a test with two databases, pass
the deps that the module's seeds take in place of `ctx`. Never look a seed up by its label in a map
you build: put the function in the row.

```ts
test.each([
  ['draft', seedNote],
  ['archived', seedArchivedNote],
])('it finds a %s note by its title', async (_label, seed) => {
  const ctx = await setupTest();
  const note = await seed(ctx, { title: 'Groceries' });

  expect(await ctx.service.searchNotes({ query: 'Groceries' })).toPartiallyContain({ id: note.id });
});
```

## A state no code in the module makes

Some states come from no code in the repo, such as a row that an older version wrote before a column
became required. Write such a row directly, only inside a seed, and name the exact state in a `//`
comment. Give each such state its own seed, and add it to the module's `build<Record>Seeder` beside
the others.

This seed writes the row itself, so it takes a partial of the table's insert shape, built with that
shape's factory, in place of the create input:

```ts
export async function seedNoteWithoutTitle(deps: NotesDeps, input: Partial<NoteRow> = {}) {
  // A note from before titles were required: createNote now refuses a missing title.
  return deps.db
    .insertInto('notes')
    .values({ ...buildMockNoteRow(input), title: null })
    .returningAll()
    .executeTakeFirstOrThrow();
}
```

When you can't name the exact state, call the module.

## Interrupted operations

Never seed a state that spans two hosts, or that an operation leaves when it stops partway, such as
a commit that one host sent and the other never got, or a reset that stopped halfway. Run the real
operation, and make it fail at the step under test with a stand-in at the boundary, such as a
transport that rejects the second call.

## A seed's own test

Put a `seed-<name>.test.ts` beside each `seed-<name>.ts` file. In it, assert the rows and files the
seed writes, and that input overrides apply. Use `toMatchObject` on a row, because the database
fills some of its fields.

Count a seed's test as one of the module's own tests, so read stored state directly in it.
