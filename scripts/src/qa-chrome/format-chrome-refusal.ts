import { match } from 'ts-pattern';
import type { ChromeRefusal } from './types';

export function formatChromeRefusal(refusal: ChromeRefusal): string {
  return match(refusal)
    .with(
      { kind: 'already-running' },
      (found) =>
        `a qa:chrome browser already runs on port ${found.port} (pid ${found.pid}); stop it with bun run qa:chrome stop`,
    )
    .with(
      { kind: 'chromium-missing' },
      () => 'chromium is not on PATH; install it, such as with sudo pacman -S chromium',
    )
    .with(
      { kind: 'no-browser' },
      () => 'no qa:chrome browser is running; start one with bun run qa:chrome start --netns',
    )
    .with(
      { kind: 'no-namespace' },
      () =>
        'the qa:chrome browser runs without a network namespace; restart it with bun run qa:chrome start --netns',
    )
    .with(
      { kind: 'pasta-missing' },
      () =>
        '--netns needs pasta, which is not on PATH; install the passt package, such as with sudo pacman -S passt',
    )
    .with(
      { kind: 'port-busy' },
      (found) =>
        `a DevTools endpoint already answers on 127.0.0.1:${found.port}; pick another port with --port`,
    )
    .with(
      { kind: 'tmpdir-too-long' },
      (found) =>
        `TMPDIR is ${found.bytes} bytes, and Chromium fails with "Socket path too long" over ${found.limit}; rerun with a shorter one, such as TMPDIR=$XDG_RUNTIME_DIR`,
    )
    .exhaustive();
}
