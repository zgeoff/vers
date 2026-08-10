import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createAvatarService } from './create-avatar-service';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  const service = await createAvatarService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-avatar', db: db.db });

  const client = buildRPCTestClient<AvatarContract>(service.app, { token: viewer.token });

  await client.createAvatar({ name: 'Wired' });

  const rows = await db.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createAvatarService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});
