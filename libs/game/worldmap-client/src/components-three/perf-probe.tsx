import { useFrame } from '@react-three/fiber';
import { useRenderer } from '@vers/game-rendering';
import { useEffect, useRef } from 'react';
import { scatterBuildStats } from '../scatter-build-stats';
import { setPerfStats } from '../state/set-perf-stats';

const SAMPLE_INTERVAL_MS = 500;

interface RenderInfo {
  readonly calls?: number;
  readonly drawCalls?: number;
  readonly triangles?: number;
}

interface RollingFrameWindow {
  count: number;
  elapsedMs: number;
  worstFrameMs: number;
}

export function PerfProbe() {
  const renderer = useRenderer();
  const frameWindow = useRef<RollingFrameWindow>({ count: 0, elapsedMs: 0, worstFrameMs: 0 });

  useEffect(() => {
    const previousAutoReset = renderer.info.autoReset;

    // three's own animation loop resets `info.render` on its own rAF cadence, which races the R3F
    // loop that drives the render here and can zero the counts before this probe reads them, so the
    // probe owns the reset per tick; the renderer outlives scene swaps, so cleanup restores it
    renderer.info.autoReset = false;

    return () => {
      renderer.info.autoReset = previousAutoReset;
    };
  }, [renderer]);

  useFrame((_state, delta) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- WebGPURenderer's type claims info.render always carries drawCalls, but the classic WebGLRenderer some test harnesses construct by default carries calls in its place; RenderInfo reflects both
    const render = renderer.info.render as unknown as RenderInfo;
    const drawCalls = render.drawCalls ?? render.calls ?? 0;
    const triangleCount = render.triangles ?? 0;

    // Zeroes the counts this probe just read, so the next read covers only the frame after this
    // one — see the ownership note on the mount effect above.
    renderer.info.reset();

    const rolling = frameWindow.current;
    const deltaMs = delta * 1000;

    rolling.count += 1;
    rolling.elapsedMs += deltaMs;
    rolling.worstFrameMs = Math.max(rolling.worstFrameMs, deltaMs);

    if (rolling.elapsedMs < SAMPLE_INTERVAL_MS) {
      return;
    }

    setPerfStats({
      drawCalls,
      fps: (rolling.count / rolling.elapsedMs) * 1000,
      scatterBuildMs: scatterBuildStats.buildMs,
      scatterGlowCount: scatterBuildStats.glowCount,
      scatterPartCount: scatterBuildStats.partCount,
      triangleCount,
      worstFrameMs: rolling.worstFrameMs,
    });

    rolling.count = 0;
    rolling.elapsedMs = 0;
    rolling.worstFrameMs = 0;
  });

  return null;
}
