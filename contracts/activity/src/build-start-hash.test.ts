import { expect, test } from 'bun:test';
import { buildStartHash } from './build-start-hash';

test('it builds a deterministic hex digest for a given input', () => {
  const input = {
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash(input)).toBe(buildStartHash(input));
});

test('it produces different hashes for different activity ids', () => {
  const input = {
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash({ ...input, activityID: 'act_1' })).not.toBe(
    buildStartHash({ ...input, activityID: 'act_2' }),
  );
});

test('it produces different hashes for different key versions', () => {
  const input = {
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash({ ...input, keyVersion: 1 })).not.toBe(
    buildStartHash({ ...input, keyVersion: 2 }),
  );
});

test('it produces different hashes for different encounter node difficulties', () => {
  const input = {
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash({ ...input, encounterNode: { difficulty: 1 } })).not.toBe(
    buildStartHash({ ...input, encounterNode: { difficulty: 2 } }),
  );
});

test('it produces a 64-character hex digest', () => {
  const hash = buildStartHash({
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  });

  expect(hash).toMatch(/^[a-f0-9]{64}$/);
});

test('it derives the frozen canonical digest for a known input', () => {
  const hash = buildStartHash({
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  });

  expect(hash).toMatchInlineSnapshot(
    `"4ab272b69a20623a933eb177838f601bb3d786a401a70dcf8cd2928072a6c203"`,
  );
});
