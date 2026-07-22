import { expect, test } from 'bun:test';
import { createReplayProvider } from './create-replay-provider';

test('it boots from env.SIM_ENGINE_HASH', async () => {
  const service = await createReplayProvider();

  expect(service.env.SIM_ENGINE_HASH).toBe('test-engine-hash');
});
