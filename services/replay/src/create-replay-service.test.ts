import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildStateFromSeed } from '@vers/game-utils';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { updateEnv } from '@vers/test-utils/bun';
import { createReplayService } from './create-replay-service';
import { createHonestActivityFixture } from './test-utils/create-honest-activity-fixture';

test('it boots from env.SIM_ENGINE_HASH', async () => {
  const service = await createReplayService();

  expect(service.env.SIM_ENGINE_HASH).toBe('test-engine-hash');
});

test('it resolves the private key from env.SERVICE_AUTH_PRIVATE_KEY before returning', async () => {
  const service = await createReplayService();

  expect(service.privateKey.type).toBe('private');
});

test('it exposes the injected db for the worker to share with the router', async () => {
  await using ctx = await createTestDB();

  const service = await createReplayService({ db: ctx.db });

  expect(service.db).toBe(ctx.db);
});

test('it fails to boot on a malformed private key, before any listen', async () => {
  updateEnv('SERVICE_AUTH_PRIVATE_KEY', 'not-a-valid-pkcs8-key');

  await expect(createReplayService()).toReject();
});

test('it never destroys an injected db when stopped', async () => {
  await using ctx = await createTestDB();

  const service = await createReplayService({ db: ctx.db });

  await service.stopDB();

  // The injected handle is still usable — a destroyed pool would reject any further query.
  await expect(ctx.db.selectFrom('activities').select('id').limit(1).execute()).toResolve();
});

test('it drains a claimable chain through the same deps the wake procedure closes over', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  await createContentVersion(ctx.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createReplayService({ db: ctx.db });

  await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const drained = await service.drain('boot');

  expect(drained).toBe(1);
});

test('it accepts a call from service-activity', async () => {
  const service = await createReplayService();

  const viewer = await createAnonymousViewer({
    audience: 'service-replay',
    issuer: 'service-activity',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/wake', {
      body: JSON.stringify({ json: {} }),
      headers: { authorization: `Bearer ${viewer.token}`, 'content-type': 'application/json' },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(200);
});

test('it rejects a call from app-web with 403', async () => {
  const service = await createReplayService();
  const viewer = await createAnonymousViewer({ audience: 'service-replay', issuer: 'app-web' });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/wake', {
      headers: { authorization: `Bearer ${viewer.token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(403);
});
