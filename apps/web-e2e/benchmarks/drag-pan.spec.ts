import { expect, test } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';
import { waitForStableFrames } from '../src/wait-for-stable-frames';

// legs never alternate direction: a there-and-back drag revisits chunks whose generation is already
// cached, so the benchmark would measure cache replays instead of the generation cost it tracks
const DRAG_LEG_COUNT = 12;
const DRAG_STEPS_PER_LEG = 20;
const DROPPED_FRAME_THRESHOLD_MS = 32;

interface DragPanWindow {
  __dragPanFrameGaps: Array<number>;
  __dragPanFrameLoopID: number;
}

// run with `--headed`: headless Chromium's software WebGPU path measures compositor throughput
// rather than the app's own frame cost
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

  // a throwaway warm-up leg, run before the sampler is installed, so the measured legs don't pay
  // for what a first drag itself warms up (pointer-event handler JIT, first-drag camera-controls
  // allocations). Ends at rightX, where the first measured leg starts.
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
