import { expect, mock, onTestFinished, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { toJSON } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { waitFor } from '@vers/test-utils';
import { updateEnv } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { createReplayService } from './create-replay-service';
import { createHonestActivityFixture } from './test-utils/create-honest-activity-fixture';
import { updateAvatarChainsReplayPending } from './test-utils/update-avatar-chains-replay-pending';

test('it boots from env.SIM_ENGINE_HASH', async () => {
  const service = await createReplayService();

  onTestFinished(() => service.stop());

  expect(service.env.SIM_ENGINE_HASH).toBe('test-engine-hash');
});

test('it resolves the private key from env.SERVICE_AUTH_PRIVATE_KEY before returning', async () => {
  const service = await createReplayService();

  onTestFinished(() => service.stop());

  expect(service.resources.privateKey.type).toBe('private');
});

test('it exposes the injected db for the worker to share with the router', async () => {
  await using ctx = await createTestDB();

  const service = await createReplayService({ db: ctx.db });

  expect(service.resources.db).toBe(ctx.db);
});

test('it stops serving, destroys the db it built and exits 0 on SIGTERM', async () => {
  const exit = mock((_code: number) => {});

  const service = await createReplayService();

  onTestFinished(() => service.stop());

  service.serve({ exit, port: 0 });
  process.emit('SIGTERM');

  await waitFor(() => {
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  expect(service.resources.db.selectFrom('activities').select('id').execute()).rejects.toThrow();
});

test('it fails to boot on a malformed private key, before any listen', async () => {
  updateEnv('SERVICE_AUTH_PRIVATE_KEY', 'not-a-valid-pkcs8-key');

  await expect(createReplayService()).toReject();
});

test('it never destroys an injected db when stopped', async () => {
  await using ctx = await createTestDB();

  const service = await createReplayService({ db: ctx.db });

  await service.stop();

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

test('it drains a claimable chain after the cache clears a driver the previous drain held', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  await createContentVersion(ctx.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createReplayService({ db: ctx.db });

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const firstBatchCount = Math.max(1, Math.floor(totalCheckpoints / 2));

  expect(firstBatchCount).toBeLessThan(totalCheckpoints);

  await ctx.db
    .deleteFrom('activityCheckpoints')
    .where('activityId', '=', fixture.activity.id)
    .where('version', '>', firstBatchCount)
    .execute();

  const firstBatchLastHash = fixture.checkpoints[firstBatchCount - 1]?.hash;

  invariant(
    firstBatchLastHash !== undefined,
    'the fixture always has a checkpoint at the split index',
  );

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: firstBatchCount, lastHash: firstBatchLastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const firstDrained = await service.drain('boot');

  expect(firstDrained).toBe(1);

  service.resources.cache.stopAll();

  const remaining = fixture.checkpoints.slice(firstBatchCount);

  await ctx.db
    .insertInto('activityCheckpoints')
    .values(
      remaining.map((checkpoint) => ({
        activityId: fixture.activity.id,
        hash: checkpoint.hash,
        payload: toJSON(checkpoint.payload),
        prevHash: checkpoint.prevHash,
        version: checkpoint.version,
      })),
    )
    .execute();

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: totalCheckpoints, lastHash: fixture.activity.lastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  await updateAvatarChainsReplayPending(ctx.db, fixture.activity.avatarId);

  const secondDrained = await service.drain('boot');

  expect(secondDrained).toBe(1);

  const updated = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.verifiedHead).toBe(totalCheckpoints);
});

test('it accepts a call from service-activity', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  const service = await createReplayService({ db: ctx.db });

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
