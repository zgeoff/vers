import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { buildPlayerProfiles } from './build-player-profiles';

test('it cycles the level corpus and stamps every nth player with the retained version', () => {
  expect(
    buildPlayerProfiles({
      count: 4,
      firstIndex: 5,
      retainedEvery: 3,
      versions: { current: 'engine-current', retained: 'engine-retained' },
    }),
  ).toStrictEqual([
    {
      failureAction: ActivityFailureAction.Retry,
      index: 5,
      level: 12,
      simVersion: 'engine-current',
    },
    {
      failureAction: ActivityFailureAction.Retry,
      index: 6,
      level: 1,
      simVersion: 'engine-retained',
    },
    {
      failureAction: ActivityFailureAction.Retry,
      index: 7,
      level: 2,
      simVersion: 'engine-current',
    },
    {
      failureAction: ActivityFailureAction.Retry,
      index: 8,
      level: 3,
      simVersion: 'engine-current',
    },
  ]);
});

test('it builds the same profiles for the same input', () => {
  const input = {
    count: 6,
    firstIndex: 0,
    retainedEvery: 4,
    versions: { current: 'engine-current', retained: 'engine-retained' },
  };

  expect(buildPlayerProfiles(input)).toStrictEqual(buildPlayerProfiles(input));
});
