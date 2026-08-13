import { expect, onTestFinished, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { scatterBuildStats } from '../scatter-build-stats';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { PerfProbe } from './perf-probe';

test('it samples fps, worst-frame timing, and scatter build stats once the sample window elapses', async () => {
  scatterBuildStats.buildMs = 12;
  scatterBuildStats.glowCount = 40;
  scatterBuildStats.partCount = 400;

  onTestFinished(() => {
    scatterBuildStats.buildMs = 0;
    scatterBuildStats.glowCount = 0;
    scatterBuildStats.partCount = 0;
  });

  const renderer = await ReactThreeTestRenderer.create(<PerfProbe />);

  // 30 frames at a constant 1/60s delta cross the 500ms sample window on the 30th frame
  await renderer.advanceFrames(30, 1 / 60);

  expect(useWorldmapStore.getState().perfStats).toStrictEqual({
    drawCalls: 0,
    fps: expect.toBeWithin(59, 61),
    scatterBuildMs: 12,
    scatterGlowCount: 40,
    scatterPartCount: 400,
    triangleCount: 0,
    worstFrameMs: expect.toBeWithin(16, 17),
  });
});

test('it writes nothing to the store before the sample window elapses', async () => {
  const renderer = await ReactThreeTestRenderer.create(<PerfProbe />);

  await renderer.advanceFrames(10, 1 / 60);

  expect(useWorldmapStore.getState().perfStats).toBeNull();
});
