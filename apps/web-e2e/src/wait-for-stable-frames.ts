import type { Page } from '@playwright/test';

/**
 * A frame gap under this many milliseconds counts as settled — loose enough that a single fast
 * frame during mount doesn't pass it, tight enough that a still-loading scene's own long frames
 * keep failing it.
 */
const STABLE_FRAME_GAP_THRESHOLD_MS = 20;

/**
 * Consecutive settled frames required before the scene counts as ready. One fast frame can land by
 * chance while world data is still loading, a field is still building, or first-frame WebGPU
 * pipelines are still compiling; a run of them can't.
 */
const STABLE_FRAME_COUNT = 5;

/**
 * How long the gate keeps trying before it fails with an explicit message. A machine whose scene
 * never settles (software WebGPU, heavy contention) would otherwise hang the gate silently until
 * the whole test times out, hiding which step hung.
 */
const STABLE_GATE_BUDGET_MS = 60 * 1000;

/**
 * Waits for a live rendering scene to settle into steady frames, rather than proceeding the instant
 * its canvas mounts. A persistent canvas is often already visible from the previous route, so a
 * `toBeVisible()` check returns before the scene has loaded its data, built its fields, or compiled
 * its first-frame WebGPU pipelines — mount-cost frame gaps would otherwise dominate anything the
 * caller measures next. Throws with an explicit message if the scene never settles within the gate
 * budget, so a stuck scene names itself rather than failing later as an opaque test timeout.
 */
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
