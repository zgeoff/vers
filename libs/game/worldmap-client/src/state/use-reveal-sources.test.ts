import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setCompletedNodeProjections } from './set-completed-node-projections';
import { useRevealSources } from './use-reveal-sources';

test('it returns the current reveal sources', () => {
  const sources = [{ coord: [0, 0] as const, radius: 2 }];

  setCompletedNodeProjections(new Set(), sources);

  const hook = renderHook(() => useRevealSources());

  expect(hook.result.current).toBe(sources);
});
