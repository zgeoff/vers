/**
 * SPIKE: dev perf HUD — frame rate, renderer stats, and scatter build stats, written straight into
 * a fixed DOM overlay from the frame loop. Not production code.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { scatterStats } from './biome-scatter';

const HUD_ID = 'spike-perf-hud';

export function PerfProbe() {
  const frames = useRef({ count: 0, last: performance.now(), worst: 0 });

  useEffect(() => {
    const hud = document.createElement('div');

    hud.id = HUD_ID;
    hud.style.cssText =
      'position:fixed;bottom:8px;left:8px;z-index:9999;background:rgba(10,12,18,0.85);color:#9fe8ff;font:11px monospace;padding:6px 8px;border-radius:4px;pointer-events:none;white-space:pre';
    document.body.append(hud);

    return () => {
      hud.remove();
    };
  }, []);

  useFrame((state, delta) => {
    const f = frames.current;

    f.count += 1;
    f.worst = Math.max(f.worst, delta * 1000);

    const now = performance.now();
    const elapsed = now - f.last;

    if (elapsed < 500) {
      return;
    }

    const fps = (f.count / elapsed) * 1000;
    const hud = document.getElementById(HUD_ID);

    if (hud) {
      // three's WebGPU renderer keeps the same info shape as WebGL for draws and triangles
      const info = (state.gl as unknown as { info?: { render?: Record<string, number> } }).info;
      const render = info?.render ?? {};
      const draws = render['drawCalls'] ?? render['calls'] ?? -1;
      const triangles = render['triangles'] ?? -1;

      hud.textContent =
        `fps ${fps.toFixed(0)}  worst ${f.worst.toFixed(0)}ms\n` +
        `draws ${draws}  tris ${(triangles / 1000).toFixed(0)}k\n` +
        `scatter ${scatterStats.parts} parts + ${scatterStats.glow} glow\n` +
        `last scatter build ${scatterStats.buildMs.toFixed(0)}ms`;
    }

    f.count = 0;
    f.worst = 0;
    f.last = now;
  });

  return null;
}
