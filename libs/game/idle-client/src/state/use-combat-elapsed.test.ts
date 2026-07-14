import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockCombatExecutorSnapshot } from '@vers/idle-core/test-utils';
import { useCombatElapsed } from './use-combat-elapsed';
import { useIdleStore } from './use-idle-store';

test('it provides the elapsed combat time', () => {
  const combat = createMockCombatExecutorSnapshot({ elapsed: 1000 });

  useIdleStore.setState({ combat });

  const hook = renderHook(() => useCombatElapsed());

  expect(hook.result.current).toBe(1000);
});
