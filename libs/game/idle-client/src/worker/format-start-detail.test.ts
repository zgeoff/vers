import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { formatStartDetail } from './format-start-detail';

test('it names the minted start with its chain index, folded XP and predecessor', () => {
  const activity = createMockActivityData({
    buildSnapshot: { level: 2, xp: 140 },
    id: 'act_minted',
    predecessorActivityID: 'act_before',
    startChainIndex: 7,
  });

  expect(formatStartDetail('2_4', { activity, kind: 'started' })).toBe(
    '2_4 started act_minted index=7 xp=140 predecessor=act_before',
  );
});

test('it names an avatar first start with no predecessor', () => {
  const activity = createMockActivityData({
    buildSnapshot: { level: 1, xp: 0 },
    id: 'act_first',
    predecessorActivityID: null,
    startChainIndex: 0,
  });

  expect(formatStartDetail('0_0', { activity, kind: 'started' })).toBe(
    '0_0 started act_first index=0 xp=0 predecessor=none',
  );
});

test('it names only the outcome of a start that minted nothing', () => {
  expect(formatStartDetail('3_1', { kind: 'unreconstructed' })).toBe('3_1 unreconstructed');
});
