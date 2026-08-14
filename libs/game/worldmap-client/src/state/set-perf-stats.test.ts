import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setPerfStats } from './set-perf-stats';
import { useWorldmapStore } from './use-worldmap-store';

test('it sets the perf stats in the store', () => {
  const perfStats = {
    drawCalls: 12,
    fps: 60,
    scatterBuildMs: 24,
    scatterGlowCount: 40,
    scatterPartCount: 400,
    triangleCount: 12_000,
    worstFrameMs: 7,
  };

  setPerfStats(perfStats);

  const hook = renderHook(() => useWorldmapStore((state) => state.perfStats));

  expect(hook.result.current).toStrictEqual(perfStats);
});
