import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { CombatExecutorSnapshot } from '@vers/idle-core';
import { setCombat } from './set-combat';
import { useCombat } from './use-combat';

test('it provides the combat state', () => {
  const combat: CombatExecutorSnapshot = {
    elapsed: 1000,
  };

  setCombat(combat);

  const hook = renderHook(() => useCombat());

  expect(hook.result.current).toStrictEqual({
    elapsed: 1000,
  });
});
