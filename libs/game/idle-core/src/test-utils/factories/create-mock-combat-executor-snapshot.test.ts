import { expect, test } from 'bun:test';
import { createMockCombatExecutorSnapshot } from './create-mock-combat-executor-snapshot';

test('it creates a combat executor snapshot with expected properties', () => {
  const combat = createMockCombatExecutorSnapshot();

  expect(combat).toStrictEqual({ elapsed: 0 });
});

test('it creates a combat executor snapshot with custom properties', () => {
  const combat = createMockCombatExecutorSnapshot({ elapsed: 1000 });

  expect(combat).toStrictEqual({ elapsed: 1000 });
});
