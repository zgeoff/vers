import { expect, test } from 'bun:test';
import { buildMockModelActivity } from '../factories/build-mock-model-activity';
import { buildMockModelCheckpoint } from '../factories/build-mock-model-checkpoint';
import { collectSettlementViolations } from './collect-settlement-violations';

test('it finds nothing wrong in a proved prefix paid once', () => {
  const activity = buildMockModelActivity({ appendedHead: 3, id: 'act_first' });

  const violations = collectSettlementViolations({
    activities: [activity],
    current: {
      activities: [
        {
          appendedHead: 3,
          id: 'act_first',
          settledXP: 10,
          status: 'active',
          verifiedHead: 2,
          writer: 'device-a',
        },
      ],
      avatarXP: 10,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    previous: {
      activities: [
        {
          appendedHead: 3,
          id: 'act_first',
          settledXP: 0,
          status: 'active',
          verifiedHead: 0,
          writer: 'device-a',
        },
      ],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
  });

  expect(violations).toStrictEqual([]);
});

test('it reports a chain position that two activities both settled', () => {
  const violations = collectSettlementViolations({
    activities: [
      buildMockModelActivity({ id: 'act_first', status: 'rejected' }),
      buildMockModelActivity({ id: 'act_second', predecessorID: 'act_first' }),
    ],
    current: {
      activities: [
        {
          appendedHead: 3,
          id: 'act_first',
          settledXP: 10,
          status: 'rejected',
          verifiedHead: 2,
          writer: null,
        },
        {
          appendedHead: 2,
          id: 'act_second',
          settledXP: 10,
          status: 'active',
          verifiedHead: 2,
          writer: null,
        },
      ],
      avatarXP: 20,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    previous: {
      activities: [],
      avatarXP: 0,
      chains: [],
      grants: [],
      items: [],
    },
  });

  expect(violations).toStrictEqual([
    'reward: act_second and act_first both settled position 0_0:2',
  ]);
});

test('it reports an activity paid more than its proved prefix is worth', () => {
  const violations = collectSettlementViolations({
    activities: [buildMockModelActivity({ id: 'act_first' })],
    current: {
      activities: [
        {
          appendedHead: 2,
          id: 'act_first',
          settledXP: 11,
          status: 'active',
          verifiedHead: 2,
          writer: null,
        },
      ],
      avatarXP: 11,
      chains: [],
      grants: [],
      items: [],
    },
    previous: { activities: [], avatarXP: 0, chains: [], grants: [], items: [] },
  });

  expect(violations).toStrictEqual([
    'reward: act_first settled 11 XP for a proved prefix worth 10',
  ]);
});

test('it reports an item minted for a slot no proved checkpoint holds', () => {
  const violations = collectSettlementViolations({
    activities: [
      buildMockModelActivity({
        checkpoints: [
          buildMockModelCheckpoint({ type: 'started', version: 1, xp: 0 }),
          buildMockModelCheckpoint({ rewardOrdinals: [0], version: 2, xp: 10 }),
        ],
        id: 'act_first',
      }),
    ],
    current: {
      activities: [
        {
          appendedHead: 2,
          id: 'act_first',
          settledXP: 0,
          status: 'active',
          verifiedHead: 1,
          writer: null,
        },
      ],
      avatarXP: 0,
      chains: [],
      grants: [],
      items: ['0_0:2:0'],
    },
    previous: { activities: [], avatarXP: 0, chains: [], grants: [], items: [] },
  });

  expect(violations).toStrictEqual([
    'reward: items missing [], items without a proved slot [0_0:2:0]',
  ]);
});

test('it reports a head that moved backward and a status that left a terminal state', () => {
  const violations = collectSettlementViolations({
    activities: [buildMockModelActivity({ id: 'act_first' })],
    current: {
      activities: [
        {
          appendedHead: 1,
          id: 'act_first',
          settledXP: 0,
          status: 'active',
          verifiedHead: 0,
          writer: null,
        },
      ],
      avatarXP: 0,
      chains: [],
      grants: [],
      items: [],
    },
    previous: {
      activities: [
        {
          appendedHead: 2,
          id: 'act_first',
          settledXP: 0,
          status: 'stopped',
          verifiedHead: 0,
          writer: null,
        },
      ],
      avatarXP: 0,
      chains: [],
      grants: [],
      items: [],
    },
  });

  expect(violations).toStrictEqual([
    'cursor: act_first moved a head backward',
    'cursor: act_first moved from stopped to active',
  ]);
});

test('it reports a verified head that covers a forged checkpoint', () => {
  const violations = collectSettlementViolations({
    activities: [buildMockModelActivity({ id: 'act_first', tamperedVersion: 2 })],
    current: {
      activities: [
        {
          appendedHead: 2,
          id: 'act_first',
          settledXP: 10,
          status: 'active',
          verifiedHead: 2,
          writer: null,
        },
      ],
      avatarXP: 10,
      chains: [],
      grants: [],
      items: [],
    },
    previous: { activities: [], avatarXP: 0, chains: [], grants: [], items: [] },
  });

  expect(violations).toStrictEqual(['cursor: act_first verified its tampered checkpoint 2']);
});

test('it reports a rejected activity that settled more after its rejection', () => {
  const violations = collectSettlementViolations({
    activities: [buildMockModelActivity({ id: 'act_first' })],
    current: {
      activities: [
        {
          appendedHead: 3,
          id: 'act_first',
          settledXP: 18,
          status: 'rejected',
          verifiedHead: 3,
          writer: null,
        },
      ],
      avatarXP: 18,
      chains: [],
      grants: [],
      items: [],
    },
    previous: {
      activities: [
        {
          appendedHead: 3,
          id: 'act_first',
          settledXP: 10,
          status: 'rejected',
          verifiedHead: 2,
          writer: null,
        },
      ],
      avatarXP: 10,
      chains: [],
      grants: [],
      items: [],
    },
  });

  expect(violations).toStrictEqual(['cursor: act_first settled more after its rejection']);
});

test('it reports anchors that moved against the chain rules', () => {
  const violations = collectSettlementViolations({
    activities: [],
    current: {
      activities: [],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 2, scopeID: '0_0', verifiedChainIndex: 3 }],
      grants: [],
      items: [],
    },
    previous: {
      activities: [],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 8, scopeID: '0_0', verifiedChainIndex: 5 }],
      grants: [],
      items: [],
    },
  });

  expect(violations).toStrictEqual([
    'cursor: chain 0_0 appended anchor sits behind its verified one',
    'cursor: chain 0_0 moved its verified anchor backward',
    'cursor: chain 0_0 pulled its appended anchor back past the verified one',
  ]);
});

test('it reports an activity settled while an earlier one behind an empty run is unsettled', () => {
  const violations = collectSettlementViolations({
    activities: [
      buildMockModelActivity({ id: 'act_earlier', scopeID: '1_0' }),
      buildMockModelActivity({ id: 'act_empty', predecessorID: 'act_earlier' }),
      buildMockModelActivity({ id: 'act_later', predecessorID: 'act_empty' }),
    ],
    current: {
      activities: [
        {
          appendedHead: 3,
          id: 'act_earlier',
          settledXP: 0,
          status: 'stopped',
          verifiedHead: 0,
          writer: null,
        },
        {
          appendedHead: 0,
          id: 'act_empty',
          settledXP: 0,
          status: 'stopped',
          verifiedHead: 0,
          writer: null,
        },
        {
          appendedHead: 2,
          id: 'act_later',
          settledXP: 10,
          status: 'stopped',
          verifiedHead: 2,
          writer: null,
        },
      ],
      avatarXP: 10,
      chains: [],
      grants: [],
      items: [],
    },
    previous: { activities: [], avatarXP: 0, chains: [], grants: [], items: [] },
  });

  expect(violations).toStrictEqual(['predecessor: act_later settled before act_earlier did']);
});
