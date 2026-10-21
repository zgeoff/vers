import { useFrame } from '@react-three/fiber';
import { useRenderer } from '@vers/game-rendering';
import { useEffect, useRef } from 'react';
import { scatterBuildStats } from '../scatter-build-stats';
import { setPerfStats } from '../state/set-perf-stats';

const SAMPLE_INTERVAL_MS = 500;

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
    setInfoAutoReset(renderer, false);

    return () => {
      setInfoAutoReset(renderer, previousAutoReset);
    };
  }, [renderer]);

  useFrame((_state, delta) => {
    const render = renderer.info.render;

    // WebGPU's info counts draws in drawCalls and render passes in calls; WebGL's counts draws in calls
    const drawCalls = 'drawCalls' in render ? render.drawCalls : render.calls;
    const triangleCount = render.triangles;

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

function setInfoAutoReset(renderer: ReturnType<typeof useRenderer>, autoReset: boolean): void {
  renderer.info.autoReset = autoReset;
}
