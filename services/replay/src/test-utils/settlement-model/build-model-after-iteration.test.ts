import { expect, test } from 'bun:test';
import { buildMockModelActivity } from '../factories/build-mock-model-activity';
import { buildMockModelCheckpoint } from '../factories/build-mock-model-checkpoint';
import { buildModelAfterIteration } from './build-model-after-iteration';

test('it goes idle when no activity has unverified checkpoints', () => {
  const model = {
    activities: [buildMockModelActivity({ appendedHead: 2, settledXP: 10, verifiedHead: 2 })],
    avatarXP: 10,
    chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  };

  expect(buildModelAfterIteration(model)).toStrictEqual({ model, outcome: 'idle' });
});

test('it settles part of an active run without moving the verified anchor', () => {
  const result = buildModelAfterIteration({
    activities: [buildMockModelActivity({ appendedHead: 2 })],
    avatarXP: 0,
    chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  });

  expect(result).toStrictEqual({
    model: {
      activities: [buildMockModelActivity({ appendedHead: 2, settledXP: 10, verifiedHead: 2 })],
      avatarXP: 10,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    outcome: 'claimed',
  });
});

test('it moves the verified anchor to the tail of a stopped run it proves to the end', () => {
  const result = buildModelAfterIteration({
    activities: [buildMockModelActivity({ appendedHead: 3, status: 'stopped' })],
    avatarXP: 0,
    chains: [{ appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  });

  expect(result.model.chains).toStrictEqual([
    { appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 3 },
  ]);
});

test('it grants the first clear and mints the reward slots of a proved completed run', () => {
  const result = buildModelAfterIteration({
    activities: [
      buildMockModelActivity({
        appendedHead: 3,
        checkpoints: [
          buildMockModelCheckpoint({ type: 'started', version: 1, xp: 0 }),
          buildMockModelCheckpoint({ rewardOrdinals: [0], version: 2, xp: 10 }),
          buildMockModelCheckpoint({
            rewardOrdinals: [0, 1],
            type: 'completed',
            version: 3,
            xp: 90,
          }),
        ],
        startChainIndex: 4,
        status: 'stopped',
      }),
    ],
    avatarXP: 0,
    chains: [{ appendedChainIndex: 7, scopeID: '0_0', verifiedChainIndex: 4 }],
    grants: [],
    items: [],
  });

  expect(result.model).toMatchObject({
    avatarXP: 90,
    grants: ['0_0'],
    items: ['0_0:6:0', '0_0:7:0', '0_0:7:1'],
  });
});

test('it rejects a first pass whose pinned build differs from the settled XP and rewinds the chain', () => {
  const result = buildModelAfterIteration({
    activities: [buildMockModelActivity({ appendedHead: 3, buildXP: 40, status: 'stopped' })],
    avatarXP: 0,
    chains: [{ appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  });

  expect(result.model.activities[0]?.status).toBe('rejected');

  expect(result.model.chains).toStrictEqual([
    { appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 },
  ]);
});

test('it rejects a forged segment, keeps the positions the run proved spent and voids later runs', () => {
  const result = buildModelAfterIteration({
    activities: [
      buildMockModelActivity({
        appendedHead: 3,
        id: 'act_forged',
        settledXP: 10,
        status: 'stopped',
        tamperedVersion: 3,
        verifiedHead: 2,
      }),
      buildMockModelActivity({
        appendedHead: 1,
        id: 'act_later',
        predecessorID: 'act_forged',
        startChainIndex: 3,
      }),
    ],
    avatarXP: 10,
    chains: [{ appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  });

  expect(result.model).toMatchObject({
    activities: [
      { id: 'act_forged', settledXP: 10, status: 'rejected', verifiedHead: 2 },
      { id: 'act_later', status: 'rejected' },
    ],
    avatarXP: 10,
    chains: [{ appendedChainIndex: 2, scopeID: '0_0', verifiedChainIndex: 2 }],
  });
});

test('it settles an earlier unsettled run before a later one behind a run that appended nothing', () => {
  const result = buildModelAfterIteration({
    activities: [
      buildMockModelActivity({
        appendedHead: 3,
        id: 'act_earlier',
        scopeID: '1_0',
        startChainIndex: 9,
        status: 'stopped',
      }),
      buildMockModelActivity({ id: 'act_empty', predecessorID: 'act_earlier', status: 'stopped' }),
      buildMockModelActivity({
        appendedHead: 3,
        buildXP: 18,
        id: 'act_later',
        predecessorID: 'act_empty',
        status: 'stopped',
      }),
    ],
    avatarXP: 0,
    chains: [
      { appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 },
      { appendedChainIndex: 12, scopeID: '1_0', verifiedChainIndex: 9 },
    ],
    grants: [],
    items: [],
  });

  expect(result.model.activities).toMatchObject([
    { id: 'act_earlier', verifiedHead: 3 },
    { id: 'act_empty', verifiedHead: 0 },
    { id: 'act_later', status: 'stopped', verifiedHead: 0 },
  ]);
});

test('it catches the verified anchor up from the proved run that ends where the claim starts', () => {
  const result = buildModelAfterIteration({
    activities: [
      buildMockModelActivity({
        appendedHead: 3,
        id: 'act_earlier',
        settledXP: 18,
        status: 'stopped',
        verifiedHead: 3,
      }),
      buildMockModelActivity({
        appendedHead: 2,
        buildXP: 18,
        id: 'act_next',
        predecessorID: 'act_earlier',
        startChainIndex: 3,
      }),
    ],
    avatarXP: 18,
    chains: [{ appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  });

  expect(result.model).toMatchObject({
    activities: [{ id: 'act_earlier' }, { id: 'act_next', status: 'active', verifiedHead: 2 }],
    chains: [{ appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 3 }],
  });
});

test('it rejects a first pass that starts away from the verified anchor', () => {
  const result = buildModelAfterIteration({
    activities: [buildMockModelActivity({ appendedHead: 2, startChainIndex: 5 })],
    avatarXP: 0,
    chains: [{ appendedChainIndex: 5, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  });

  expect(result.model.activities[0]?.status).toBe('rejected');
});
