import { expect, test } from 'bun:test';
import { buildMockModelActivity } from '../factories/build-mock-model-activity';
import { buildClientBuildXP } from './build-client-build-xp';

test('it folds the appended XP of every earlier activity into the next build', () => {
  const model = {
    activities: [
      buildMockModelActivity({ appendedHead: 3, id: 'act_first', status: 'stopped' }),
      buildMockModelActivity({ appendedHead: 2, id: 'act_second', status: 'stopped' }),
    ],
    avatarXP: 0,
    chains: [],
    grants: [],
    items: [],
  };

  expect(buildClientBuildXP(model)).toBe(28);
});

test('it counts only what the server paid for an activity it rejected', () => {
  const model = {
    activities: [
      buildMockModelActivity({
        appendedHead: 3,
        id: 'act_rejected',
        settledXP: 10,
        status: 'rejected',
        verifiedHead: 2,
      }),
    ],
    avatarXP: 10,
    chains: [],
    grants: [],
    items: [],
  };

  expect(buildClientBuildXP(model)).toBe(10);
});
