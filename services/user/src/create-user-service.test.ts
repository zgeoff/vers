import { expect, test } from 'bun:test';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createUserService } from './create-user-service';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  const service = await createUserService({ db: db.db });
  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(service.app, { token: viewer.token });

  await client.createUser({
    email: 'wired@example.com',
    name: 'Wired User',
    password: 'password123',
    username: 'wired_user',
  });

  const rows = await db.db.selectFrom('users').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createUserService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});
