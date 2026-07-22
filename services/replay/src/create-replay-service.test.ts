import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { createTestDB } from '@vers/service-test-utils/bun';
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

  const service = await createReplayService({ db: ctx.db });

  await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  await expect(service.drain()).resolves.toBe(1);
});
