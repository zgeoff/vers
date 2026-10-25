import { expect, test } from 'bun:test';
import { buildMockModelActivity } from '../factories/build-mock-model-activity';
import { buildModelAfterStart } from './build-model-after-start';

test('it opens a chain at genesis for the first activity on a scope', () => {
  const activity = buildMockModelActivity({ scopeID: '1_0' });

  const model = buildModelAfterStart(
    { activities: [], avatarXP: 0, chains: [], grants: [], items: [] },
    activity,
  );

  expect(model).toStrictEqual({
    activities: [activity],
    avatarXP: 0,
    chains: [{ appendedChainIndex: 0, scopeID: '1_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  });
});

test('it keeps the anchors of a chain an earlier activity opened', () => {
  const earlier = buildMockModelActivity({ id: 'act_earlier', status: 'stopped' });
  const activity = buildMockModelActivity({ id: 'act_next', startChainIndex: 3 });

  const model = buildModelAfterStart(
    {
      activities: [earlier],
      avatarXP: 18,
      chains: [{ appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 3 }],
      grants: [],
      items: [],
    },
    activity,
  );

  expect(model.chains).toStrictEqual([
    { appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 3 },
  ]);

  expect(model.activities).toStrictEqual([earlier, activity]);
});
