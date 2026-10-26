import { expect, test } from 'bun:test';
import { makePlayElapsed } from './make-play-elapsed';

test('it reads the time played so far while play runs', () => {
  const clock = { nowMs: 1000 };

  const playElapsed = makePlayElapsed({
    now: () => clock.nowMs,
    signal: new AbortController().signal,
  });

  clock.nowMs = 4500;

  expect(playElapsed()).toBe(3500);
});

test('it freezes the time played at the moment the stop signal fires', () => {
  const clock = { nowMs: 1000 };

  const controller = new AbortController();

  const playElapsed = makePlayElapsed({ now: () => clock.nowMs, signal: controller.signal });

  clock.nowMs = 11_000;

  controller.abort();

  clock.nowMs = 130_000;

  expect(playElapsed()).toBe(10_000);
});

test('it reads no time played for a player stopped before it started', () => {
  const clock = { nowMs: 1000 };

  const controller = new AbortController();

  controller.abort();

  const playElapsed = makePlayElapsed({ now: () => clock.nowMs, signal: controller.signal });

  clock.nowMs = 5000;

  expect(playElapsed()).toBe(0);
});
