import { expect, test } from 'bun:test';
import { buildStartHash } from './build-start-hash';

test('it builds a deterministic hex digest for a given input', () => {
  const input = {
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash(input)).toBe(buildStartHash(input));
});

test('it produces different hashes for different activity ids', () => {
  const input = {
    contentVersion: '0.0.0-dev',
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
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash({ ...input, keyVersion: 1 })).not.toBe(
    buildStartHash({ ...input, keyVersion: 2 }),
  );
});

test('it produces a 64-character hex digest', () => {
  const hash = buildStartHash({
    activityID: 'act_1',
    contentVersion: '0.0.0-dev',
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
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  });

  expect(hash).toBe('9dde57ef8fcd6f75e8075e4a2511d829b3b03be2c7e62c0a04ca3ee718629581');
});
