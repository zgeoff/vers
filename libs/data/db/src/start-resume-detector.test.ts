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

test('it reports the elapsed wall time on a check that runs before the next tick', () => {
  let clock = 1_000_000;
  const onResume = mock<(elapsedMs: number) => void>();

  // a 60s interval keeps the timer from ticking during the test, so the check is the only reader
  const detector = startResumeDetector({
    intervalMs: 60_000,
    now: () => clock,
    onResume,
    thresholdMs: 50,
  });

  onTestFinished(() => {
    detector.stop();
  });

  clock += 61_000;

  detector.check();

  expect(onResume).toHaveBeenCalledExactlyOnceWith(61_000);
});

test('it stays quiet on a check when the clock advanced less than the threshold', () => {
  let clock = 1_000_000;
  const onResume = mock<(elapsedMs: number) => void>();

  const detector = startResumeDetector({
    intervalMs: 60_000,
    now: () => clock,
    onResume,
    thresholdMs: 50,
  });

  onTestFinished(() => {
    detector.stop();
  });

  clock += 40;

  detector.check();

  expect(onResume).not.toHaveBeenCalled();
});

test('it reports a jump once when a check consumes it before the timer ticks', async () => {
  let clock = 1_000_000;
  const onResume = mock<(elapsedMs: number) => void>();
  const now = mock(() => clock);
  const detector = startResumeDetector({ intervalMs: 5, now, onResume, thresholdMs: 50 });

  onTestFinished(() => {
    detector.stop();
  });

  clock += 90_000;

  detector.check();

  const callsAtCheck = now.mock.calls.length;

  await waitFor(() => {
    expect(now.mock.calls.length).toBeGreaterThan(callsAtCheck + 2);
  });

  expect(onResume).toHaveBeenCalledExactlyOnceWith(90_000);
});
