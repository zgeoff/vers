import { expect, test } from 'bun:test';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import pino from 'pino';
import { startReplayWorker } from './start-replay-worker';

test('it starts against an idle queue and stop resolves once the loop exits', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  const keyPair = await getTestServiceKeyPair();

  const worker = startReplayWorker({
    db: ctx.db,
    logger: pino({ enabled: false }),
    privateKey: keyPair.privateKey,
    simVersion: 'test-engine-hash',
  });

  await expect(worker.stop()).toResolve();
});
