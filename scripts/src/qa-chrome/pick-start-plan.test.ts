import { expect, test } from 'bun:test';
import { pickStartPlan } from './pick-start-plan';

test('it launches chromium on the host network without --netns', () => {
  expect(
    pickStartPlan({
      chromiumPath: '/usr/bin/chromium',
      isNetns: false,
      pastaPath: null,
      running: undefined,
      tmpdir: '/tmp',
    }),
  ).toStrictEqual({ chromiumPath: '/usr/bin/chromium', kind: 'launch', pastaPath: null });
});

test('it launches chromium through pasta with --netns', () => {
  expect(
    pickStartPlan({
      chromiumPath: '/usr/bin/chromium',
      isNetns: true,
      pastaPath: '/usr/bin/pasta',
      running: undefined,
      tmpdir: '/run/user/1000',
    }),
  ).toStrictEqual({
    chromiumPath: '/usr/bin/chromium',
    kind: 'launch',
    pastaPath: '/usr/bin/pasta',
  });
});

test('it refuses a start while a browser already runs', () => {
  expect(
    pickStartPlan({
      chromiumPath: '/usr/bin/chromium',
      isNetns: true,
      pastaPath: '/usr/bin/pasta',
      running: { leaderPID: 4100, leaderStartTime: '880', namespace: null, port: 9222 },
      tmpdir: '/tmp',
    }),
  ).toStrictEqual({ kind: 'already-running', pid: 4100, port: 9222 });
});

test('it refuses a start when chromium is not on PATH', () => {
  expect(
    pickStartPlan({
      chromiumPath: null,
      isNetns: false,
      pastaPath: null,
      running: undefined,
      tmpdir: '/tmp',
    }),
  ).toStrictEqual({ kind: 'chromium-missing' });
});

test('it refuses a --netns start when pasta is not on PATH', () => {
  expect(
    pickStartPlan({
      chromiumPath: '/usr/bin/chromium',
      isNetns: true,
      pastaPath: null,
      running: undefined,
      tmpdir: '/tmp',
    }),
  ).toStrictEqual({ kind: 'pasta-missing' });
});

test('it accepts a TMPDIR of 62 bytes', () => {
  expect(
    pickStartPlan({
      chromiumPath: '/usr/bin/chromium',
      isNetns: false,
      pastaPath: null,
      running: undefined,
      tmpdir: `/${'t'.repeat(61)}`,
    }),
  ).toStrictEqual({ chromiumPath: '/usr/bin/chromium', kind: 'launch', pastaPath: null });
});

test('it refuses a TMPDIR of 63 bytes', () => {
  expect(
    pickStartPlan({
      chromiumPath: '/usr/bin/chromium',
      isNetns: false,
      pastaPath: null,
      running: undefined,
      tmpdir: `/${'t'.repeat(62)}`,
    }),
  ).toStrictEqual({ bytes: 63, kind: 'tmpdir-too-long', limit: 62 });
});

test('it measures TMPDIR in bytes, not characters', () => {
  expect(
    pickStartPlan({
      chromiumPath: '/usr/bin/chromium',
      isNetns: false,
      pastaPath: null,
      running: undefined,
      tmpdir: `/${'é'.repeat(31)}`,
    }),
  ).toStrictEqual({ bytes: 63, kind: 'tmpdir-too-long', limit: 62 });
});
