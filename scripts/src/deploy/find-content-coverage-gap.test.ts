import { expect, test } from 'bun:test';
import { findContentCoverageGap } from './find-content-coverage-gap';

test('it reports no gap when the active engine covers the current content', () => {
  expect(findContentCoverageGap({ currentContentVersion: '2', maxContentVersion: '3' })).toBeNull();
  expect(findContentCoverageGap({ currentContentVersion: '3', maxContentVersion: '3' })).toBeNull();
});

test('it reports a gap when the current content is newer than the engine supports', () => {
  expect(findContentCoverageGap({ currentContentVersion: '4', maxContentVersion: '3' })).toBe(
    "content version 4 is newer than the active engine's max content version 3",
  );
});

test('it reports a gap when content is published but no active engine is registered', () => {
  expect(findContentCoverageGap({ currentContentVersion: '2', maxContentVersion: undefined })).toBe(
    'content version 2 is current but no active engine is registered to replay it',
  );
});

test('it reports no gap before any content is published', () => {
  expect(
    findContentCoverageGap({ currentContentVersion: undefined, maxContentVersion: '3' }),
  ).toBeNull();
});

test('it reports a gap for a version that is not a numeric string', () => {
  expect(findContentCoverageGap({ currentContentVersion: 'v2', maxContentVersion: '3' })).toBe(
    'content versions are numeric strings; got current v2 and engine max 3',
  );
});
