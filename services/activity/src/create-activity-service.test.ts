import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { CURRENT_CONTENT_VERSION, getEncounterContent } from '@vers/game-utils';
import { getTables } from '@vers/item-gen';
import { createAvatarRow, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from './create-activity-service';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
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
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ contentVersion: CURRENT_CONTENT_VERSION, keyVersion: 1 });
});

test('it stamps a default content version both the item and encounter content dispatches can load', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(() => getTables(activity.contentVersion)).not.toThrow();
  expect(() => getEncounterContent(activity.contentVersion)).not.toThrow();
});

test('it uses an injected content version when given', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);

  const service = await createActivityService({ contentVersion: 'content_9', db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ contentVersion: 'content_9' });
});

test('it uses an injected key version when given', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db, keyVersion: 7 });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(activity).toMatchObject({ keyVersion: 7 });
});
