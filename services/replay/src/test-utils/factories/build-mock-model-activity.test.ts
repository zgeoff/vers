import { expect, test } from 'bun:test';
import { buildMockModelActivity } from './build-mock-model-activity';
import { buildMockModelCheckpoint } from './build-mock-model-checkpoint';

test('it builds an active activity with a three-checkpoint stream and nothing delivered', () => {
  expect(buildMockModelActivity()).toStrictEqual({
    appendedHead: 0,
    buildXP: 0,
    checkpoints: [
      buildMockModelCheckpoint({ type: 'started', version: 1, xp: 0 }),
      buildMockModelCheckpoint({ version: 2, xp: 10 }),
      buildMockModelCheckpoint({ version: 3, xp: 8 }),
    ],
    id: 'act_model',
    predecessorID: null,
    scopeID: '0_0',
    settledXP: 0,
    startChainIndex: 0,
    status: 'active',
    tamperedVersion: null,
    verifiedHead: 0,
    writer: null,
  });
});

test('it applies overrides on top of the defaults', () => {
  expect(
    buildMockModelActivity({ appendedHead: 2, id: 'act_other', status: 'stopped' }),
  ).toMatchObject({ appendedHead: 2, id: 'act_other', status: 'stopped' });
});
