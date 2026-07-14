import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from './create-activity-service';
import { createAvatarRow } from './test-utils/create-avatar-row';

async function setupTest() {
  const db = await createTestDB();

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

// Each call acquires its own transaction-isolated handle from the same shared worker database
// (`@vers/service-test-utils/bun`'s default isolation). These two tests prove the rollback
// actually holds across test boundaries — order-dependent by design.

test('it creates an activity visible within this test', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  const rows = await ctx.db.selectFrom('activities').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it starts with no activities left over from the previous test', async () => {
  await using ctx = await setupTest();

  const rows = await ctx.db.selectFrom('activities').selectAll().execute();

  expect(rows).toBeEmpty();
});
