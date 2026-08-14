import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setPerfStats } from './set-perf-stats';
import { usePerfStats } from './use-perf-stats';

test('it returns the current perf stats', () => {
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

  const hook = renderHook(() => usePerfStats());

  expect(hook.result.current).toStrictEqual(perfStats);
});
