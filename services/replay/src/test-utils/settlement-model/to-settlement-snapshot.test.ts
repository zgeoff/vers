import { expect, test } from 'bun:test';
import { buildMockModelActivity } from '../factories/build-mock-model-activity';
import { toSettlementSnapshot } from './to-settlement-snapshot';

test('it projects the stored fields of the model, ordered by activity id and chain scope', () => {
  const snapshot = toSettlementSnapshot({
    activities: [
      buildMockModelActivity({ appendedHead: 2, id: 'act_b', writer: 'device-a' }),
      buildMockModelActivity({
        appendedHead: 3,
        id: 'act_a',
        settledXP: 18,
        status: 'stopped',
        verifiedHead: 3,
      }),
    ],
    avatarXP: 18,
    chains: [
      { appendedChainIndex: 4, scopeID: '1_0', verifiedChainIndex: 0 },
      { appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 3 },
    ],
    grants: ['1_0'],
    items: ['0_0:2:0'],
  });

  expect(snapshot).toStrictEqual({
    activities: [
      {
        appendedHead: 3,
        id: 'act_a',
        settledXP: 18,
        status: 'stopped',
        verifiedHead: 3,
        writer: null,
      },
      {
        appendedHead: 2,
        id: 'act_b',
        settledXP: 0,
        status: 'active',
        verifiedHead: 0,
        writer: 'device-a',
      },
    ],
    avatarXP: 18,
    chains: [
      { appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 3 },
      { appendedChainIndex: 4, scopeID: '1_0', verifiedChainIndex: 0 },
    ],
    grants: ['1_0'],
    items: ['0_0:2:0'],
  });
});
