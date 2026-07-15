import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createReplayService } from './create-replay-service';

test('it boots from env.SIM_ENGINE_HASH', async () => {
  const service = await createReplayService();

  expect(service.env.SIM_ENGINE_HASH).toBe('test-engine-hash');
});

test('it resolves the private key from env.SERVICE_AUTH_PRIVATE_KEY', async () => {
  const service = await createReplayService();
  const privateKey = await service.privateKey;

  expect(privateKey.type).toBe('private');
});

test('it exposes the injected db for the worker to share with the router', async () => {
  await using ctx = await createTestDB();

  const service = await createReplayService({ db: ctx.db });

  expect(service.db).toBe(ctx.db);
});
