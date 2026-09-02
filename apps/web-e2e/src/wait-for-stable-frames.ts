import type { Page } from '@playwright/test';

const STABLE_FRAME_GAP_THRESHOLD_MS = 20;
const STABLE_FRAME_COUNT = 5;
const STABLE_GATE_BUDGET_MS = 60 * 1000;

// a persistent canvas is often already visible from the previous route, so a visibility check
// passes before the scene has loaded its data, built its fields, or compiled its first-frame WebGPU
// pipelines
export async function waitForStableFrames(page: Page): Promise<void> {
  const settled = await page.evaluate(
    ({ budgetMs, stableFrameCount, thresholdMs }) =>
      new Promise<boolean>((resolve) => {
        const startedAt = performance.now();
        let consecutiveStableFrames = 0;
        let last = performance.now();

        const advanceFrame = () => {
          const now = performance.now();
          const gap = now - last;

          last = now;
          consecutiveStableFrames = gap < thresholdMs ? consecutiveStableFrames + 1 : 0;

          if (consecutiveStableFrames >= stableFrameCount) {
            resolve(true);

            return;
          }

          if (now - startedAt > budgetMs) {
            resolve(false);

            return;
          }

          requestAnimationFrame(advanceFrame);
        };

        requestAnimationFrame(advanceFrame);
      }),
    {
      budgetMs: STABLE_GATE_BUDGET_MS,
      stableFrameCount: STABLE_FRAME_COUNT,
      thresholdMs: STABLE_FRAME_GAP_THRESHOLD_MS,
    },
  );

  if (!settled) {
    throw new Error(
      `the scene never settled within ${STABLE_GATE_BUDGET_MS}ms — ` +
        `no run of ${STABLE_FRAME_COUNT} consecutive frames under ${STABLE_FRAME_GAP_THRESHOLD_MS}ms`,
    );
  }
}
