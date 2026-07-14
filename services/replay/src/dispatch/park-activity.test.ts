import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { parkActivity } from './park-activity';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it parks an active activity', async () => {
  const ctx = await setupTest();
  const activity = await createActivityRow(ctx.db, { status: 'active' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toMatchObject({ id: activity.id, status: 'parked' });
});

test('it leaves a quarantined activity untouched', async () => {
  const ctx = await setupTest();
  const activity = await createActivityRow(ctx.db, { status: 'quarantined' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toBeUndefined();

  const row = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.status).toBe('quarantined');
});

test('it leaves a stopped activity untouched', async () => {
  const ctx = await setupTest();
  const activity = await createActivityRow(ctx.db, { status: 'stopped' });
  const parked = await parkActivity(ctx.db, activity.id);

  expect(parked).toBeUndefined();

  const row = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.status).toBe('stopped');
});
