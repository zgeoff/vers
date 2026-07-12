import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createAvatarService } from './create-avatar-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

// Each call acquires its own transaction-isolated handle from the same shared worker database
// (`@vers/service-test-utils/bun`'s default isolation). These two tests prove the rollback
// actually holds across test boundaries — order-dependent by design.

test('it creates an avatar visible within this test', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  await client.createAvatar({ name: 'IsolationProof' });

  const rows = await ctx.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it starts with no avatars left over from the previous test', async () => {
  await using ctx = await setupTest();

  const rows = await ctx.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toBeEmpty();
});
