import { expect, mock, onTestFinished, spyOn, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { createAvatarService } from './create-avatar-service';
import { readAvatars } from './handlers/read-avatars';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  const service = await createAvatarService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-avatar', db: db.db });

  const client = buildRPCTestClient<AvatarContract>(service.app, { token: viewer.token });

  const created = await client.createAvatar({ name: 'Wired' });

  const roster = await readAvatars(db.db, {
    context: { actingUserID: viewer.user.id },
    errors: { UNAUTHORIZED: () => new Error('the read names its acting user') },
  });

  expect(roster).toStrictEqual({ activeAvatarID: created.id, avatars: [created] });
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createAvatarService();

  onTestFinished(() => service.stop());

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it stops serving, destroys the db it built and exits 0 on SIGTERM', async () => {
  const exit = mock((_code: number) => {});

  const service = await createAvatarService();

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

  const service = await createAvatarService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-avatar', db: db.db, issuer: 'app-web' });

  const client = buildRPCTestClient<AvatarContract>(service.app, { token: viewer.token });

  await expect(client.createAvatar({ name: 'Accepted' })).toResolve();
});

test('it rejects a call from service-activity with 403', async () => {
  await using db = await createTestDB();

  const service = await createAvatarService({ db: db.db });

  const viewer = await createViewer({
    audience: 'service-avatar',
    db: db.db,
    issuer: 'service-activity',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/createAvatar', {
      headers: { authorization: `Bearer ${viewer.token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(403);
});
