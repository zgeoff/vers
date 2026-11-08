import { expect, mock, onTestFinished, spyOn, test } from 'bun:test';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { createUserService } from './create-user-service';
import { readUser } from './handlers/read-user';

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

  const user = await readUser(db.db, { input: { email: 'wired@example.com' } });

  expect(user).toStrictEqual({
    createdAt: expect.toBeValidDate(),
    email: 'wired@example.com',
    id: expect.any(String),
    name: 'Wired User',
    seed: expect.any(Number),
    updatedAt: expect.toBeValidDate(),
    username: 'wired_user',
  });
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createUserService();

  onTestFinished(() => service.stop());

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it stops serving, destroys the db it built and exits 0 on SIGTERM', async () => {
  const exit = mock((_code: number) => {});

  const service = await createUserService();

  onTestFinished(() => service.stop());

  const destroy = spyOn(service.resources.db, 'destroy');

  service.serve({ exit, port: 0 });
  process.emit('SIGTERM');

  await waitFor(() => {
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  expect(destroy).toHaveBeenCalledOnce();
});

test('it accepts a call from app-web', async () => {
  await using db = await createTestDB();

  const service = await createUserService({ db: db.db });
  const viewer = await createAnonymousViewer({ audience: 'service-user', issuer: 'app-web' });

  const client = buildRPCTestClient<UserContract>(service.app, { token: viewer.token });

  await expect(
    client.createUser({
      email: 'accepted@example.com',
      name: 'Accepted User',
      password: 'password123',
      username: 'accepted_user',
    }),
  ).toResolve();
});

test('it rejects a call from service-activity with 403', async () => {
  await using db = await createTestDB();

  const service = await createUserService({ db: db.db });

  const viewer = await createAnonymousViewer({
    audience: 'service-user',
    issuer: 'service-activity',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/createUser', {
      headers: { authorization: `Bearer ${viewer.token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(403);
});
