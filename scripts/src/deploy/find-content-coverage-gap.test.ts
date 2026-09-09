import { expect, test } from 'bun:test';
import { findContentCoverageGap } from './find-content-coverage-gap';

test('it reports no gap when the active engine covers the content version', () => {
  expect(findContentCoverageGap({ contentVersion: '2', maxContentVersion: '3' })).toBeNull();
  expect(findContentCoverageGap({ contentVersion: '3', maxContentVersion: '3' })).toBeNull();
});

test('it reports a gap when the content is newer than the engine supports', () => {
  expect(findContentCoverageGap({ contentVersion: '4', maxContentVersion: '3' })).toBe(
    "content version 4 is newer than the active engine's max content version 3",
  );
});

test('it reports a gap when content exists but no active engine is registered', () => {
  expect(findContentCoverageGap({ contentVersion: '2', maxContentVersion: undefined })).toBe(
    'content version 2 has no active engine registered to replay it',
  );
});

test('it reports no gap before any content is published', () => {
  expect(findContentCoverageGap({ contentVersion: undefined, maxContentVersion: '3' })).toBeNull();
});

test.each([
  ['v2', '3'],
  ['', '3'],
  ['1e3', '3'],
  [' 5 ', '3'],
  ['2', 'Infinity'],
  ['2', '0x10'],
])(
  'it reports a gap for a version that is not a numeric string: content %s, engine %s',
  (contentVersion, maxContentVersion) => {
    expect(findContentCoverageGap({ contentVersion, maxContentVersion })).toBe(
      `content versions are numeric strings; got content ${contentVersion} and engine max ${maxContentVersion}`,
    );
  },
);
