import { useFrame } from '@react-three/fiber';
import { useRenderer } from '@vers/game-rendering';
import { useEffect, useRef } from 'react';
import { scatterBuildStats } from '../scatter-build-stats';
import { setPerfStats } from '../state/set-perf-stats';

/**
 * How often the rolling frame-timing window folds into a store write. Short enough to feel live in
 * the dev tools panel, long enough that the write itself never shows up in the numbers it reports.
 */
const SAMPLE_INTERVAL_MS = 500;

/**
 * three ships two renderer classes with two different `info.render` shapes: the common
 * WebGPU/WebGL-fallback backend this app always constructs in production names the per-frame draw
 * count `drawCalls`; the classic `WebGLRenderer` some test harnesses construct by default names the
 * same count `calls` and carries no `drawCalls` field at all.
 */
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

/**
 * Samples frame timing and the renderer's draw stats into the store roughly twice a second, for
 * the dev tools panel's perf HUD. Every read happens inside `useFrame`, never a memo — concurrent
 * rendering can interrupt and replay a memo, which would misreport the elapsed time between two
 * unrelated renders as a frame duration.
 *
 * The renderer never resets `info.render` on its own here: that reset lives in an internal
 * animation loop this app never starts, since R3F drives its own `requestAnimationFrame` loop and
 * calls `renderer.render()` directly. This probe owns the reset instead, exactly as three's own
 * `Info` docs prescribe for an app managing its own loop — reading each tick's counts one frame
 * after the render they describe, then zeroing them so the next read covers only the frame after
 * that.
 */
export function PerfProbe() {
  const renderer = useRenderer();
  const frameWindow = useRef<RollingFrameWindow>({ count: 0, elapsedMs: 0, worstFrameMs: 0 });

  useEffect(() => {
    renderer.info.autoReset = false;
  }, [renderer]);

  useFrame((_state, delta) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- WebGPURenderer's type claims info.render always carries drawCalls, but the classic WebGLRenderer some test harnesses construct by default carries calls in its place; RenderInfo reflects both
    const render = renderer.info.render as unknown as RenderInfo;
    const drawCalls = render.drawCalls ?? render.calls ?? 0;
    const triangleCount = render.triangles ?? 0;

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
