import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createAvatarService } from '../create-avatar-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it updates the name of an owned avatar and reports the updated id', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const created = await client.createAvatar({ class: 'brute', name: 'Renameable' });

  const result = await client.updateAvatar({ id: created.id, name: 'Renamed' });

  expect(result).toStrictEqual({ updatedID: created.id });

  const row = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirstOrThrow();

  expect(row.name).toBe('Renamed');
});

test('it returns NOT_FOUND updating an avatar the caller does not own', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const other = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const foreign = await createAvatarRow(ctx.db, { name: 'Unrenameable', userId: other.user.id });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.updateAvatar({ id: foreign.id, name: 'Hijacked' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.updateAvatar({ id: 'x', name: 'Anonymous' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
