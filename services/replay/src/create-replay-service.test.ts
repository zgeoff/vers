import { expect, test } from 'bun:test';
import { createReplayService } from './create-replay-service';

test('it boots from env.SIM_ENGINE_HASH', async () => {
  const service = await createReplayService();

  expect(service.env.SIM_ENGINE_HASH).toBe('test-engine-hash');
});
