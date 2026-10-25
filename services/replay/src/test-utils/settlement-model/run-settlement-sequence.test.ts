import { expect, onTestFinished, test } from 'bun:test';
import { resolveServiceURL } from '@vers/mock-services';
import { createActivityService } from '@vers/service-activity';
import { createTestDB, resolveTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { updateEnv } from '@vers/test-utils/bun';
import fc from 'fast-check';
import { buildSettlementCaseArbitrary } from './build-settlement-case-arbitrary';
import { runSettlementSequence } from './run-settlement-sequence';

// The activity handlers and the verifier each open their own transactions, which the default
// transaction-isolation handle can't nest, so every test runs against a committed schema clone.
async function setupTest() {
  const testDB = await createTestDB({ isolation: 'schema' });

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  // this package's env names no replay service, which the activity service wakes after an append
  updateEnv('REPLAY_SERVICE_URL', resolveServiceURL('replay'));
  updateEnv('LOG_LEVEL', 'fatal');

  const service = await createActivityService({ db: testDB.db });
  const keyPair = await resolveTestServiceKeyPair();

  return { app: service.app, db: testDB.db, privateKey: keyPair.privateKey };
}

test('it finds no failure in an honest run handed between devices and settled in segments', async () => {
  const ctx = await setupTest();

  const failure = await runSettlementSequence(ctx, {
    avatarSeed: 11,
    commands: [
      { durationMs: 45_000, genesis: 3, kind: 'start', scopeID: '0_0' },
      { count: 3, device: 'device-a', kind: 'deliver' },
      { kind: 'settle-one' },
      { count: 2, device: 'device-a', kind: 'redeliver', skip: 0 },
      { device: 'device-b', kind: 'takeover' },
      { count: 3, device: 'device-a', kind: 'deliver' },
      { count: 3, device: 'device-b', kind: 'deliver' },
      { device: 'device-b', kind: 'stop' },
      { durationMs: 12_000, genesis: 5, kind: 'start', scopeID: '1_0' },
      { count: 3, device: 'device-a', kind: 'deliver' },
    ],
  });

  expect(failure).toBeUndefined();
});

test("it removes every row of a case's avatar once the case ends", async () => {
  const ctx = await setupTest();

  await runSettlementSequence(ctx, {
    avatarSeed: 11,
    commands: [
      { durationMs: 12_000, genesis: 3, kind: 'start', scopeID: '0_0' },
      { count: 3, device: 'device-a', kind: 'deliver' },
    ],
  });

  const avatars = await ctx.db.selectFrom('avatars').select('id').execute();
  const activities = await ctx.db.selectFrom('activities').select('id').execute();

  expect(avatars).toStrictEqual([]);
  expect(activities).toStrictEqual([]);
});

test('it keeps generated append, duplicate-delivery and partial-settlement sequences in line with the model', async () => {
  const ctx = await setupTest();

  await fc.assert(
    fc.asyncProperty(
      buildSettlementCaseArbitrary({
        kinds: ['start', 'deliver', 'redeliver', 'stop', 'settle-one', 'settle-all'],
        maxCommands: 24,
      }),
      async (settlementCase) => {
        const failure = await runSettlementSequence(ctx, settlementCase);

        expect(failure).toBeUndefined();
      },
    ),
    { numRuns: 15 },
  );
});

test('it keeps generated stop and takeover sequences in line with the model', async () => {
  const ctx = await setupTest();

  await fc.assert(
    fc.asyncProperty(
      buildSettlementCaseArbitrary({
        kinds: ['start', 'deliver', 'redeliver', 'stop', 'takeover', 'settle-one', 'settle-all'],
        maxCommands: 24,
      }),
      async (settlementCase) => {
        const failure = await runSettlementSequence(ctx, settlementCase);

        expect(failure).toBeUndefined();
      },
    ),
    { numRuns: 15 },
  );
});

test('it keeps generated rejection sequences in line with the model', async () => {
  const ctx = await setupTest();

  await fc.assert(
    fc.asyncProperty(
      buildSettlementCaseArbitrary({
        kinds: ['start', 'deliver', 'forge', 'stop', 'settle-one', 'settle-all'],
        maxCommands: 24,
      }),
      async (settlementCase) => {
        const failure = await runSettlementSequence(ctx, settlementCase);

        expect(failure).toBeUndefined();
      },
    ),
    { numRuns: 15 },
  );
});

test('it keeps the positions a rejected activity proved spent', async () => {
  const ctx = await setupTest();

  const failure = await runSettlementSequence(ctx, {
    avatarSeed: 0,
    commands: [
      { durationMs: 12_000, genesis: 0, kind: 'start', scopeID: '0_0' },
      { count: 2, device: 'device-a', kind: 'deliver' },
      { kind: 'settle-one' },
      { count: 1, device: 'device-a', kind: 'forge' },
      { kind: 'settle-one' },
      { durationMs: 12_000, genesis: 0, kind: 'start', scopeID: '0_0' },
      { count: 3, device: 'device-a', kind: 'deliver' },
    ],
  });

  expect(failure).toBeUndefined();
});

test('it settles an earlier activity before a later one queued behind an activity that appended nothing', async () => {
  const ctx = await setupTest();

  const failure = await runSettlementSequence(ctx, {
    avatarSeed: 1,
    commands: [
      { durationMs: 12_000, genesis: 7, kind: 'start', scopeID: '1_0' },
      { count: 3, device: 'device-a', kind: 'deliver' },
      { device: 'device-a', kind: 'stop' },
      { kind: 'settle-all' },
      { durationMs: 12_000, genesis: 7, kind: 'start', scopeID: '1_0' },
      { count: 3, device: 'device-a', kind: 'deliver' },
      { device: 'device-a', kind: 'stop' },
      { durationMs: 12_000, genesis: 9, kind: 'start', scopeID: '0_0' },
      { device: 'device-a', kind: 'stop' },
      { durationMs: 12_000, genesis: 9, kind: 'start', scopeID: '0_0' },
      { count: 3, device: 'device-a', kind: 'deliver' },
      { device: 'device-a', kind: 'stop' },
    ],
  });

  expect(failure).toBeUndefined();
});
