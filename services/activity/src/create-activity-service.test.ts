import { expect, test } from 'bun:test';
import { createContentVersion, findContentDocument } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { createAvatarRow, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import invariant from 'tiny-invariant';
import { createActivityService } from './create-activity-service';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  const rows = await db.db.selectFrom('activityChains').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createActivityService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it defaults the content and key versions when none are injected', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const revealed = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  expect(revealed).toMatchObject({ keyVersion: 1 });
  expect(revealed.nodes[0]).toMatchObject({ contentVersion: '2' });
});

test('it stamps a content version whose document the registry can load', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const revealed = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  const [node] = revealed.nodes;

  invariant(node !== undefined, 'a reveal of one node returns one entry');

  expect(findContentDocument(db.db, node.contentVersion)).resolves.toBeDefined();
});

test('it uses an injected key version when given', async () => {
  await using db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db, keyVersion: 7 });
  const viewer = await createViewer({ audience: 'service-activity', db: db.db });
  const avatar = await createAvatarRow(db.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token });

  const revealed = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  expect(revealed).toMatchObject({ keyVersion: 7 });
});
