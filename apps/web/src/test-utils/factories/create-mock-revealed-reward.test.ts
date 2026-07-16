import { expect, test } from 'bun:test';
import { createMockRevealedReward } from './create-mock-revealed-reward';

test('it builds a reward slot with a full item by default', () => {
  const reward = createMockRevealedReward();

  expect(reward.chainIndex).toBeGreaterThanOrEqual(0);
  expect(reward.ordinal).toBeGreaterThanOrEqual(0);
  expect(reward.item).toContainAllKeys(['affixes', 'baseID', 'contentVersion', 'rarityID']);
});

test('it applies overrides over the defaults', () => {
  const reward = createMockRevealedReward({ chainIndex: 7, ordinal: 2 });

  expect(reward.chainIndex).toBe(7);
  expect(reward.ordinal).toBe(2);
});
