import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/bun';
import { createContentVersion, makeContentDocumentLoader } from '@vers/content-registry';
import { ContentDocumentSchema } from '@vers/contract-activity';
import { contentDocumentV2, createDB } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { resolveServiceURL } from '@vers/mock-services';
import { setSentryHandleForTesting, startErrorReporting } from '@vers/service-runtime';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { waitFor } from '@vers/test-utils';
import pino from 'pino';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { drainReplayQueue } from './drain-replay-queue';

async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(db.db, ContentDocumentSchema.parse(contentDocumentV2));

  const keyPair = await getTestServiceKeyPair();

  return {
    db: db.db,
    deps: {
      db: db.db,
      keysServiceURL: resolveServiceURL('keys'),
      loadContentDocument: makeContentDocumentLoader(db.db),
      logger: pino({ enabled: false }),
      privateKey: keyPair.privateKey,
      simVersion: 'test-engine-hash',
    },
    [Symbol.asyncDispose]: db[Symbol.asyncDispose],
  };
}

test('it returns 0 against an idle queue', async () => {
  await using ctx = await setupTest();

  expect(drainReplayQueue(ctx.deps)).resolves.toBe(0);
});

test('it drains a seeded backlog to empty and returns the count', async () => {
  await using ctx = await setupTest();

  const first = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const second = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(1_284_930_112),
  });

  const drained = await drainReplayQueue(ctx.deps);

  expect(drained).toBe(2);

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['appendedHead', 'verifiedHead'])
    .where('id', 'in', [first.activity.id, second.activity.id])
    .execute();

  expect(rows.every((row) => row.verifiedHead === row.appendedHead)).toBeTrue();
  expect(drainReplayQueue(ctx.deps)).resolves.toBe(0);
});

test('it stops draining and reports a claim failure carrying a trace id, without hanging', async () => {
  const unreachableDB = createDB({ databaseURL: 'postgresql://bad:bad@127.0.0.1:1/nope' });

  const keyPair = await getTestServiceKeyPair();

  const recorded: Array<Readonly<ErrorEvent>> = [];
  const previousHandle = setSentryHandleForTesting(undefined);

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  onTestFinished(async () => {
    await unreachableDB.destroy();
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const drained = await drainReplayQueue({
    db: unreachableDB,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(unreachableDB),
    logger: pino({ enabled: false }),
    privateKey: keyPair.privateKey,
    simVersion: 'test-engine-hash',
  });

  expect(drained).toBe(0);

  await waitFor(() => {
    expect(recorded.length).toBeGreaterThan(0);
  });

  expect(recorded[0]?.tags?.['traceID']).toMatch(/^[0-9a-f]{32}$/);
});
