import { expect, mock, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { startResumeDetector } from './start-resume-detector';

test('it reports the elapsed wall time once when the clock jumps past the threshold between ticks', async () => {
  let clock = 1_000_000;
  const onResume = mock<(elapsedMs: number) => void>();

  const detector = startResumeDetector({
    intervalMs: 5,
    now: () => clock,
    onResume,
    thresholdMs: 50,
  });

  onTestFinished(() => {
    detector.stop();
  });

  clock += 90_000;

  await waitFor(() => {
    expect(onResume).toHaveBeenCalledOnce();
  });

  expect(onResume).toHaveBeenCalledExactlyOnceWith(90_000);
});

test('it stays quiet while the clock advances at the tick rate', async () => {
  const now = mock(() => 0);
  const onResume = mock<(elapsedMs: number) => void>();

  now.mockImplementation(() => now.mock.calls.length * 5);

  const detector = startResumeDetector({ intervalMs: 5, now, onResume, thresholdMs: 50 });

  onTestFinished(() => {
    detector.stop();
  });

  await waitFor(() => {
    expect(now.mock.calls.length).toBeGreaterThan(10);
  });

  expect(onResume).not.toHaveBeenCalled();
});

test('it stops reading the clock after stop', async () => {
  const now = mock(() => 0);
  const detector = startResumeDetector({ intervalMs: 5, now, onResume: () => {}, thresholdMs: 50 });

  await waitFor(() => {
    expect(now.mock.calls.length).toBeGreaterThan(2);
  });

  detector.stop();

  const callsAtStop = now.mock.calls.length;

  // 60ms is 12 tick intervals: a timer still running would read the clock several times
  await expect(
    waitFor(
      () => {
        expect(now.mock.calls.length).toBeGreaterThan(callsAtStop);
      },
      { timeoutMs: 60 },
    ),
  ).toReject();
});
