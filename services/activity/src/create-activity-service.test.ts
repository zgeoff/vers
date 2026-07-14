import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from './create-activity-service';
import { createAvatarRow } from './test-utils/create-avatar-row';
import { createSimVersionRow } from './test-utils/create-sim-version-row';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  const rows = await db.db.selectFrom('activities').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createActivityService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it defaults the content and key versions when none are injected', async () => {
  await using db = await createTestDB();

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ contentVersion: '0.0.0-dev', keyVersion: 1 });
});

test('it uses an injected content version when given', async () => {
  await using db = await createTestDB();

  await createSimVersionRow(db.db);

  const service = await createActivityService({ contentVersion: 'content_9', db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ contentVersion: 'content_9' });
});

test('it uses an injected key version when given', async () => {
  await using db = await createTestDB();

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db, keyVersion: 7 });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ keyVersion: 7 });
});
