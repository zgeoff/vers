import { expect, test } from 'bun:test';
import { findContentDigestDrift } from './find-content-digest-drift';

test('it finds no drift when the bundled content version records the digest', () => {
  expect(
    findContentDigestDrift({
      bundledContentVersion: '4',
      digest: 'aa11',
      recordedDigests: { '3': 'ff00', '4': 'aa11' },
    }),
  ).toBeUndefined();
});

test('it reports drift when the sources changed without a new content version', () => {
  expect(
    findContentDigestDrift({
      bundledContentVersion: '4',
      digest: 'bb22',
      recordedDigests: { '3': 'ff00', '4': 'aa11' },
    }),
  ).toStrictEqual({ bundledContentVersion: '4', digest: 'bb22', recordedDigest: 'aa11' });
});

test('it reports drift when the bundled content version records no digest', () => {
  expect(
    findContentDigestDrift({
      bundledContentVersion: '5',
      digest: 'bb22',
      recordedDigests: { '4': 'aa11' },
    }),
  ).toStrictEqual({ bundledContentVersion: '5', digest: 'bb22', recordedDigest: undefined });
});

test('it reports drift when only an older content version records the digest', () => {
  expect(
    findContentDigestDrift({
      bundledContentVersion: '4',
      digest: 'ff00',
      recordedDigests: { '3': 'ff00', '4': 'aa11' },
    }),
  ).toStrictEqual({ bundledContentVersion: '4', digest: 'ff00', recordedDigest: 'aa11' });
});
