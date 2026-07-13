import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from './create-activity-service';
import { createAvatarRow } from './test-utils/create-avatar-row';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeId: 'node_1',
    scopeType: 'world_map_node',
  });

  const rows = await db.db.selectFrom('activities').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createActivityService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it defaults the sim and content versions when none are injected', async () => {
  await using db = await createTestDB();

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeId: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ contentVersion: '0.0.0-dev', simVersion: '0.0.0-dev' });
});

test('it uses injected sim and content versions when given', async () => {
  await using db = await createTestDB();

  const service = await createActivityService({
    contentVersion: 'content_9',
    db: db.db,
    simVersion: 'sim_9',
  });

  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeId: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ contentVersion: 'content_9', simVersion: 'sim_9' });
});
