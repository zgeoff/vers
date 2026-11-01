import { expect, test } from 'bun:test';
import { collectChainBlockedActivityIDs } from './collect-chain-blocked-activity-ids';

test('it blocks each start of a chain behind a predecessor the outbox still holds, but not the head', () => {
  expect(
    collectChainBlockedActivityIDs(
      [
        { id: 'act_head', predecessorActivityID: 'act_settled' },
        { id: 'act_second', predecessorActivityID: 'act_head' },
        { id: 'act_third', predecessorActivityID: 'act_second' },
      ],
      new Set(['act_head', 'act_second', 'act_third']),
    ),
  ).toStrictEqual(new Set(['act_second', 'act_third']));
});

test('it blocks a start whose predecessor is registered but has no pending start', () => {
  expect(
    collectChainBlockedActivityIDs(
      [{ id: 'act_successor', predecessorActivityID: 'act_admitted' }],
      new Set(['act_admitted', 'act_successor']),
    ),
  ).toStrictEqual(new Set(['act_successor']));
});

test('it leaves a start unblocked when the outbox holds nothing of its predecessor', () => {
  expect(
    collectChainBlockedActivityIDs(
      [{ id: 'act_successor', predecessorActivityID: 'act_settled' }],
      new Set(['act_successor']),
    ),
  ).toStrictEqual(new Set());
});

test('it leaves an avatar first start unblocked', () => {
  expect(
    collectChainBlockedActivityIDs(
      [{ id: 'act_first', predecessorActivityID: null }],
      new Set(['act_first']),
    ),
  ).toStrictEqual(new Set());
});
