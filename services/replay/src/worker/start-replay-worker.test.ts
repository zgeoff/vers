import { expect, test } from 'bun:test';
import { createDB } from '@vers/db';
import { resolveServiceURL } from '@vers/mock-services';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import pino from 'pino';
import { startReplayWorker } from './start-replay-worker';

test('it starts against an idle queue and stop resolves once the loop exits', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  const keyPair = await getTestServiceKeyPair();

  const worker = startReplayWorker({
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: keyPair.privateKey,
    simVersion: 'test-engine-hash',
  });

  await expect(worker.stop()).toResolve();
});

test('it interrupts an idle sleep on stop rather than waiting out its backoff timer', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  const keyPair = await getTestServiceKeyPair();

  const worker = startReplayWorker({
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: keyPair.privateKey,
    simVersion: 'test-engine-hash',
  });

  const startedAt = Date.now();

  await worker.stop();

  // The idle backoff climbs to MAX_POLL_INTERVAL_MS (5s); a stop that waited it out instead of
  // interrupting it would fail this bound.
  expect(Date.now() - startedAt).toBeLessThan(3000);
});

test('it does not hot-loop on a repeatedly erroring iteration, and stop still resolves', async () => {
  const unreachableDB = createDB({ databaseURL: 'postgresql://bad:bad@127.0.0.1:1/nope' });

  const keyPair = await getTestServiceKeyPair();

  const worker = startReplayWorker({
    db: unreachableDB,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: keyPair.privateKey,
    simVersion: 'test-engine-hash',
  });

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 200);
  });

  await expect(worker.stop()).toResolve();

  await unreachableDB.destroy();
});
