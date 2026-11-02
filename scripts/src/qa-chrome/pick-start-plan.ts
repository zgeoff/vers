import type { ChromeRefusal, ChromeState } from './types';

interface StartCheck {
  readonly chromiumPath: string | null;
  readonly isNetns: boolean;
  readonly pastaPath: string | null;
  readonly running: ChromeState | undefined;
  readonly tmpdir: string;
}

type StartPlan =
  | {
      readonly chromiumPath: string;
      readonly kind: 'launch';
      readonly pastaPath: string | null;
    }
  | ChromeRefusal;

// Chromium makes its singleton socket at `<TMPDIR>/org.chromium.Chromium.XXXXXX/SingletonSocket`,
// 45 bytes past TMPDIR, and a Unix socket path holds at most 107. Chromium 152 measured: a 62-byte
// TMPDIR starts, a 63-byte one dies with "Socket path too long".
const MAX_TMPDIR_BYTES = 62;

export function pickStartPlan(check: StartCheck): StartPlan {
  if (check.running !== undefined) {
    return { kind: 'already-running', pid: check.running.leaderPID, port: check.running.port };
  }

  if (check.chromiumPath === null) {
    return { kind: 'chromium-missing' };
  }

  if (check.isNetns && check.pastaPath === null) {
    return { kind: 'pasta-missing' };
  }

  const bytes = Buffer.byteLength(check.tmpdir);

  if (bytes > MAX_TMPDIR_BYTES) {
    return { bytes, kind: 'tmpdir-too-long', limit: MAX_TMPDIR_BYTES };
  }

  return {
    chromiumPath: check.chromiumPath,
    kind: 'launch',
    pastaPath: check.isNetns ? check.pastaPath : null,
  };
}
