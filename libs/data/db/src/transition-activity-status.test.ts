import { expect, test } from 'bun:test';
import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import type { DB } from './schema.generated';
import { transitionActivityStatus } from './transition-activity-status';

function setupTest() {
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (introspected) => new PostgresIntrospector(introspected),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });

  return { db };
}

test('it writes the target status on one row, guarded by the source statuses', () => {
  const ctx = setupTest();

  const compiled = transitionActivityStatus(ctx.db, 'activity-1', {
    from: ['active'],
    to: 'stopped',
  }).compile();

  expect(compiled.sql).toMatchInlineSnapshot(
    `"update "activities" set "parked_from" = $1, "status" = $2 where "status" in ($3) and "id" = $4"`,
  );

  expect(compiled.parameters).toStrictEqual([null, 'stopped', 'active', 'activity-1']);
});

test('it records the status a row leaves when it parks the row', () => {
  const ctx = setupTest();

  const compiled = transitionActivityStatus(ctx.db, 'activity-1', {
    from: ['active', 'stopped', 'capped'],
    to: 'parked',
  }).compile();

  expect(compiled.sql).toMatchInlineSnapshot(
    `"update "activities" set "parked_from" = "status", "status" = $1 where "status" in ($2, $3, $4) and "id" = $5"`,
  );

  expect(compiled.parameters).toStrictEqual([
    'parked',
    'active',
    'stopped',
    'capped',
    'activity-1',
  ]);
});

test('it moves every row a filter matches', () => {
  const ctx = setupTest();

  const compiled = transitionActivityStatus(ctx.db, (eb) => eb('avatarId', '=', 'avatar-1'), {
    from: ['active', 'stopped', 'capped'],
    to: 'rejected',
  }).compile();

  expect(compiled.sql).toMatchInlineSnapshot(
    `"update "activities" set "parked_from" = $1, "status" = $2 where "status" in ($3, $4, $5) and "avatar_id" = $6"`,
  );

  expect(compiled.parameters).toStrictEqual([
    null,
    'rejected',
    'active',
    'stopped',
    'capped',
    'avatar-1',
  ]);
});

test('it refuses a move the table lacks', () => {
  const ctx = setupTest();

  expect(() => {
    // @ts-expect-error -- a parked row never moves to rejected, so the type refuses the move too
    transitionActivityStatus(ctx.db, 'activity-1', { from: ['parked'], to: 'rejected' });
  }).toThrowWithMessage(Error, /refuses a move to rejected from parked/u);
});

test('it refuses a move that names no source status', () => {
  const ctx = setupTest();

  expect(() =>
    transitionActivityStatus(ctx.db, 'activity-1', { from: [], to: 'stopped' }),
  ).toThrowWithMessage(Error, /names at least one source status/u);
});
