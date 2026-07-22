import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { parkActivity } from './park-activity';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it parks an active activity', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { status: 'active' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toMatchObject({ id: activity.id, parkedFrom: 'active', status: 'parked' });
});

test('it parks a stopped activity, keeping the status it parked from', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { status: 'stopped' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toMatchObject({ id: activity.id, parkedFrom: 'stopped', status: 'parked' });
});

test('it parks a capped activity, keeping the status it parked from', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { status: 'capped' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toMatchObject({ id: activity.id, parkedFrom: 'capped', status: 'parked' });
});

test('it leaves a quarantined activity untouched', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { status: 'quarantined' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toBeUndefined();

  const row = await ctx.db
    .selectFrom('activities')
    .select(['parkedFrom', 'status'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ parkedFrom: null, status: 'quarantined' });
});

test('it leaves a rejected activity untouched', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { status: 'rejected' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toBeUndefined();

  const row = await ctx.db
    .selectFrom('activities')
    .select(['parkedFrom', 'status'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ parkedFrom: null, status: 'rejected' });
});

test('it keeps the first parked-from status when the activity is already parked', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { parkedFrom: 'stopped', status: 'parked' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toBeUndefined();

  const row = await ctx.db
    .selectFrom('activities')
    .select(['parkedFrom', 'status'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ parkedFrom: 'stopped', status: 'parked' });
});
