import { expect, test } from 'bun:test';
import { collectContentDigestFindings } from './collect-content-digest-findings';

test('it finds nothing when the bundled content version records the digest and the base digests stand', () => {
  expect(
    collectContentDigestFindings({
      baseDigests: { '3': 'ff00' },
      bundledContentVersion: '4',
      digest: 'aa11',
      recordedDigests: { '3': 'ff00', '4': 'aa11' },
    }),
  ).toStrictEqual([]);
});

test('it reports drift when the sources changed without a new content version', () => {
  expect(
    collectContentDigestFindings({
      baseDigests: { '4': 'aa11' },
      bundledContentVersion: '4',
      digest: 'bb22',
      recordedDigests: { '4': 'aa11' },
    }),
  ).toStrictEqual([
    { kind: 'sources-drifted', bundledContentVersion: '4', digest: 'bb22', recordedDigest: 'aa11' },
  ]);
});

test('it reports drift when the bundled content version records no digest', () => {
  expect(
    collectContentDigestFindings({
      baseDigests: {},
      bundledContentVersion: '5',
      digest: 'bb22',
      recordedDigests: { '4': 'aa11' },
    }),
  ).toStrictEqual([
    {
      kind: 'sources-drifted',
      bundledContentVersion: '5',
      digest: 'bb22',
      recordedDigest: undefined,
    },
  ]);
});

test('it reports drift when only an older content version records the digest', () => {
  expect(
    collectContentDigestFindings({
      baseDigests: {},
      bundledContentVersion: '4',
      digest: 'ff00',
      recordedDigests: { '3': 'ff00', '4': 'aa11' },
    }),
  ).toStrictEqual([
    { kind: 'sources-drifted', bundledContentVersion: '4', digest: 'ff00', recordedDigest: 'aa11' },
  ]);
});

test('it reports a base digest rewritten to match changed sources under the same content version', () => {
  expect(
    collectContentDigestFindings({
      baseDigests: { '4': 'aa11' },
      bundledContentVersion: '4',
      digest: 'bb22',
      recordedDigests: { '4': 'bb22' },
    }),
  ).toStrictEqual([
    {
      kind: 'recorded-digest-rewritten',
      baseDigest: 'aa11',
      contentVersion: '4',
      recordedDigest: 'bb22',
    },
  ]);
});

test('it reports a base digest removed from the record', () => {
  expect(
    collectContentDigestFindings({
      baseDigests: { '3': 'ff00', '4': 'aa11' },
      bundledContentVersion: '4',
      digest: 'aa11',
      recordedDigests: { '4': 'aa11' },
    }),
  ).toStrictEqual([
    {
      kind: 'recorded-digest-rewritten',
      baseDigest: 'ff00',
      contentVersion: '3',
      recordedDigest: undefined,
    },
  ]);
});

test('it accepts a new content version recorded beside the base digests', () => {
  expect(
    collectContentDigestFindings({
      baseDigests: { '4': 'aa11' },
      bundledContentVersion: '5',
      digest: 'cc33',
      recordedDigests: { '4': 'aa11', '5': 'cc33' },
    }),
  ).toStrictEqual([]);
});
