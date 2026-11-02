import { expect, test } from 'bun:test';
import { formatChromeRefusal } from './format-chrome-refusal';

test.each([
  [
    'a running browser',
    { kind: 'already-running', pid: 4100, port: 9222 } as const,
    'a qa:chrome browser already runs on port 9222 (pid 4100); stop it with bun run qa:chrome stop',
  ],
  [
    'a missing chromium',
    { kind: 'chromium-missing' } as const,
    'chromium is not on PATH; install it, such as with sudo pacman -S chromium',
  ],
  [
    'no browser',
    { kind: 'no-browser' } as const,
    'no qa:chrome browser is running; start one with bun run qa:chrome start --netns',
  ],
  [
    'a browser without a namespace',
    { kind: 'no-namespace' } as const,
    'the qa:chrome browser runs without a network namespace; restart it with bun run qa:chrome start --netns',
  ],
  [
    'a missing pasta',
    { kind: 'pasta-missing' } as const,
    '--netns needs pasta, which is not on PATH; install the passt package, such as with sudo pacman -S passt',
  ],
  [
    'a busy port',
    { kind: 'port-busy', port: 9333 } as const,
    'a DevTools endpoint already answers on 127.0.0.1:9333; pick another port with --port',
  ],
  [
    'a long TMPDIR',
    { bytes: 82, kind: 'tmpdir-too-long', limit: 62 } as const,
    'TMPDIR is 82 bytes, and Chromium fails with "Socket path too long" over 62; rerun with a shorter one, such as TMPDIR=$XDG_RUNTIME_DIR',
  ],
])('it explains the refusal of %s', (_label, refusal, expected) => {
  expect(formatChromeRefusal(refusal)).toBe(expected);
});
