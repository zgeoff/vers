import type { WebGPURenderer } from 'three/webgpu';

declare global {
  // a dev-only slot for inspecting the live renderer from the browser console
  var __versRenderer: WebGPURenderer | undefined;
}

export function registerRendererDiagnostics(renderer: WebGPURenderer): void {
  globalThis.__versRenderer = renderer;

  // a lost WebGL context or WebGPU device leaves a blank canvas and an empty console, so these
  // logs are the only place either loss is observable
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    // preventDefault marks the context eligible for browser-driven restoration; without it the
    // loss is always permanent
    event.preventDefault();
    console.error('[game-canvas] WebGL context lost', event);
  });

  // three's types omit the backend's device, and a WebGL backend or a browser without WebGPU has
  // no GPUDevice at all
  void waitForDeviceLoss(Reflect.get(renderer.backend, 'device'));
}

async function waitForDeviceLoss(device: unknown): Promise<void> {
  if (typeof GPUDevice === 'undefined' || !(device instanceof GPUDevice)) {
    return;
  }

  const report = await device.lost;

  // a 'destroyed' reason is an intentional teardown — a disposed renderer, a dev remount — not a
  // fault worth alarming over
  if (report.reason !== 'destroyed') {
    console.error(`[game-canvas] WebGPU device lost: ${report.reason} ${report.message}`);
  }
}
