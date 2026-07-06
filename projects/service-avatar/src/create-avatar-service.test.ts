import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createAvatarService } from './create-avatar-service';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();
  const { app } = await createAvatarService({ db: db.db });
  const { token } = await createViewer({ audience: 'service-avatar', db: db.db });
  const client = buildRPCTestClient<AvatarContract>(app, { token });

  await client.createAvatar({ class: 'brute', name: 'Wired' });

  const rows = await db.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it builds its own db from env.DATABASE_URL when none is injected', async () => {
  const service = await createAvatarService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});
