import { expect, test } from 'bun:test';
import { buildPlannedReturnXP } from './build-planned-return-xp';

test('it credits each activity with the XP its successor starts above it', () => {
  expect(
    buildPlannedReturnXP({ activityID: 'act_closed', xp: 100 }, [
      { buildSnapshot: { level: 2, xp: 140 }, id: 'act_second' },
      { buildSnapshot: { level: 2, xp: 140 }, id: 'act_third' },
      { buildSnapshot: { level: 3, xp: 215 }, id: 'act_open' },
    ]),
  ).toStrictEqual(
    new Map([
      ['act_closed', 40],
      ['act_second', 0],
      ['act_third', 75],
      ['act_open', 0],
    ]),
  );
});

test('it credits nothing to a return with no continuation', () => {
  expect(buildPlannedReturnXP({ activityID: 'act_closed', xp: 100 }, [])).toStrictEqual(
    new Map([['act_closed', 0]]),
  );
});
