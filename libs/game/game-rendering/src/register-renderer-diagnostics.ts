import type { WebGPURenderer } from 'three/webgpu';

interface LossReport {
  readonly message: string;
  readonly reason: string;
}

interface LossyBackend {
  readonly device?: { readonly lost?: Promise<LossReport> };
}

/**
 * Dev-only: publishes the live renderer on `window.__versRenderer` for manual inspection of its
 * resource counters, and logs GPU context loss explicitly — the WebGL context and the WebGPU
 * device can both die leaving a blank canvas and an empty console, and this is the only place
 * either loss is observable.
 */
export function registerRendererDiagnostics(renderer: WebGPURenderer): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a dev-only global slot; no global declaration is worth shipping for it
  (globalThis as unknown as { __versRenderer: WebGPURenderer }).__versRenderer = renderer;

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    // preventDefault marks the context eligible for browser-driven restoration; without it the
    // loss is always permanent
    event.preventDefault();
    console.error('[game-canvas] WebGL context lost', event);
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- three types the backend as an internal any-shaped handle; only the optional device.lost promise is read
  void waitForDeviceLoss(renderer.backend as LossyBackend);
}

async function waitForDeviceLoss(backend: LossyBackend): Promise<void> {
  const report = await backend.device?.lost;

  // a 'destroyed' reason is an intentional teardown — a disposed renderer, a dev remount — not a
  // fault worth alarming over
  if (report !== undefined && report.reason !== 'destroyed') {
    console.error(`[game-canvas] WebGPU device lost: ${report.reason} ${report.message}`);
  }
}
