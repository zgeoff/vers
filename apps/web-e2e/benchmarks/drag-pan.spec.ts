import type { Page } from '@playwright/test';
import { expect, test } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

/**
 * How many drag legs to walk. Each leg drags 60% of the canvas width in the same direction, so
 * travel accumulates leg over leg — enough total ground to cross many chunk boundaries without
 * reading the client's internal chunk-size constants, which would couple this black-box benchmark
 * to worldmap-client's geometry. Direction never alternates: a there-and-back oscillation would
 * revisit the same chunks, and once chunk generation is cached the benchmark would measure cache
 * replays instead of the generation cost it exists to track.
 */
const DRAG_LEG_COUNT = 12;

/**
 * Intermediate pointer-move events per leg. Camera-controls reads a drag as a series of pointermove
 * deltas, not a single teleport — too few steps understates a real drag's incremental chunk
 * crossings.
 */
const DRAG_STEPS_PER_LEG = 20;

/**
 * A frame gap past this many milliseconds — more than one missed vsync at 60fps — counts as a
 * dropped frame.
 */
const DROPPED_FRAME_THRESHOLD_MS = 32;

/**
 * A frame gap under this many milliseconds counts as settled for the scene-readiness gate — loose
 * enough that a single fast frame during mount doesn't pass it, tight enough that the still-loading
 * scene's own long frames keep failing it.
 */
const STABLE_FRAME_GAP_THRESHOLD_MS = 20;

/**
 * Consecutive settled frames required before the explore scene counts as ready. One fast frame can
 * land by chance while world data is still loading, the biome field is still building, or the
 * first-frame WebGPU pipelines are still compiling; a run of them can't.
 */
const STABLE_FRAME_COUNT = 5;

/**
 * How long the scene-readiness gate keeps trying before the run fails with an explicit message. A
 * machine whose scene never settles (software WebGPU, heavy contention) would otherwise hang the
 * gate silently until the whole test times out, hiding which step hung.
 */
const STABLE_GATE_BUDGET_MS = 60 * 1000;

/**
 * The frame-gap sampler's state, parked on the page's own `globalThis` so it survives across the
 * two separate `page.evaluate` round trips that start and read it.
 */
interface DragPanWindow {
  __dragPanFrameGaps: Array<number>;
  __dragPanFrameLoopID: number;
}

/**
 * Repeatable drag-pan performance probe for the explore map. Reports peak frame gap and
 * dropped-frame count for a multi-leg one-way drag across the world map to `console.log` and a
 * test annotation; it makes no pass/fail claim about specific numbers, since headless-GPU
 * throughput varies by machine.
 *
 * Excluded from every default run: this config's `testDir` is `./benchmarks`, never scanned by
 * `playwright.config.ts`'s `./specs`, so neither `bun run e2e` nor CI ever picks it up. The app
 * server serves the prebuilt artifact, so build first, then run on demand:
 *
 * ```sh
 * bun run build --filter=@vers/web
 * bun run --cwd apps/web-e2e e2e:bench -- --headed
 * ```
 *
 * `--headed` is recommended: headless Chromium's software WebGPU path measures compositor
 * throughput this benchmark doesn't care about, not the app's own frame cost.
 */
test('it drag-pans across the explore map and reports peak frame gap and dropped frames', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('e2e-drag-pan@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/respite$/);

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await expect(page).toHaveURL(/\/explore$/);

  const canvas = page.locator('canvas').first();

  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();

  if (box === null) {
    throw new Error('the explore canvas reported no bounding box');
  }

  await waitForStableFrames(page);

  const centerY = box.y + box.height / 2;
  const leftX = box.x + box.width * 0.2;
  const rightX = box.x + box.width * 0.8;

  // a throwaway warm-up leg, run before the sampler is installed, so the measured legs below don't
  // pay for whatever a drag itself first warms up (pointer-event handler JIT, first-drag camera-
  // controls allocations) on top of the scene readiness waitForStableFrames already gated on. Ends
  // at rightX, where the first measured leg (below) starts, so no extra jump sits between them.
  await page.mouse.move(leftX, centerY);
  await page.mouse.down();
  await page.mouse.move(rightX, centerY, { steps: DRAG_STEPS_PER_LEG });
  await page.mouse.up();

  await page.evaluate(() => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the sampler's state lives on the page's own globalThis with no declared type; DragPanWindow names the two fields this benchmark parks there
    const dragPanWindow = globalThis as unknown as DragPanWindow;
    const gaps: Array<number> = [];
    let last = performance.now();

    const advanceFrame = () => {
      const now = performance.now();

      gaps.push(now - last);

      last = now;
      dragPanWindow.__dragPanFrameLoopID = requestAnimationFrame(advanceFrame);
    };

    dragPanWindow.__dragPanFrameGaps = gaps;
    dragPanWindow.__dragPanFrameLoopID = requestAnimationFrame(advanceFrame);
  });

  // every measured leg drags the same direction, so the camera travels across fresh world; the
  // button-up return to the start point moves only the cursor, never the camera
  for (let leg = 0; leg < DRAG_LEG_COUNT; leg++) {
    await page.mouse.move(rightX, centerY);
    await page.mouse.down();
    await page.mouse.move(leftX, centerY, { steps: DRAG_STEPS_PER_LEG });
    await page.mouse.up();
  }

  const frameGaps = await page.evaluate(() => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see the setup evaluate above
    const dragPanWindow = globalThis as unknown as DragPanWindow;

    cancelAnimationFrame(dragPanWindow.__dragPanFrameLoopID);

    return dragPanWindow.__dragPanFrameGaps;
  });

  // the first sample is the gap from the sampler's own setup, not a rendered frame
  const renderedGaps = frameGaps.slice(1);

  expect(renderedGaps.length).toBeGreaterThan(0);

  const peakGapMs = Math.max(...renderedGaps);
  const droppedFrameCount = renderedGaps.filter((gap) => gap > DROPPED_FRAME_THRESHOLD_MS).length;

  test
    .info()
    .annotations.push(
      { description: `${peakGapMs.toFixed(1)}ms`, type: 'drag-pan-peak-frame-gap' },
      { description: `${droppedFrameCount}`, type: 'drag-pan-dropped-frames' },
    );

  console.log(
    `[drag-pan] sampled ${renderedGaps.length} frames across ${DRAG_LEG_COUNT} legs — ` +
      `peak gap ${peakGapMs.toFixed(1)}ms, ${droppedFrameCount} dropped ` +
      `(>${DROPPED_FRAME_THRESHOLD_MS}ms)`,
  );
});

/**
 * Waits for the explore scene to settle into steady rendering, rather than starting the benchmark
 * the instant its canvas mounts. The canvas locator resolves to the persistent world canvas, which
 * is already visible on the previous route, so `toBeVisible()` alone returns before the scene has
 * loaded world data, built its biome field, or compiled its first-frame WebGPU pipelines — frame
 * gaps from that mount cost would otherwise dominate the reported peak.
 */
async function waitForStableFrames(page: Page): Promise<void> {
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
      `the explore scene never settled within ${STABLE_GATE_BUDGET_MS}ms — ` +
        `no run of ${STABLE_FRAME_COUNT} consecutive frames under ${STABLE_FRAME_GAP_THRESHOLD_MS}ms`,
    );
  }
}
