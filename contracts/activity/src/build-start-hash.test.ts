import { expect, test } from 'bun:test';
import { buildStartHash } from './build-start-hash';

test('it builds a deterministic hex digest for a given input', () => {
  const input = {
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash(input)).toBe(buildStartHash(input));
});

test('it produces different hashes for different activity ids', () => {
  const input = { contentVersion: '0.0.0-dev', seed: 'seed_0', simVersion: '0.0.0-dev' };

  expect(buildStartHash({ ...input, activityID: 'act_1' })).not.toBe(
    buildStartHash({ ...input, activityID: 'act_2' }),
  );
});

test('it produces a 64-character hex digest', () => {
  const hash = buildStartHash({
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  });

  expect(hash).toMatch(/^[a-f0-9]{64}$/);
});
