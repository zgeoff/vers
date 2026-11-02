import { FFIType, dlopen } from 'bun:ffi';
import { mkdir, open } from 'node:fs/promises';
import type { ChromePaths } from './types';

export async function withChromeStateLock<T>(
  paths: ChromePaths,
  waitMs: number,
  run: () => Promise<T>,
): Promise<T> {
  await mkdir(paths.directory, { recursive: true });

  const handle = await open(paths.lockFile, 'a');

  // the kernel drops a flock when its descriptor closes, including when the process dies
  try {
    await waitForLock(handle.fd, paths.lockFile, waitMs);

    return await run();
  } finally {
    await handle.close();
  }
}

const LOCK_EXCLUSIVE = 2;
const LOCK_NONBLOCKING = 4;
const POLL_INTERVAL_MS = 100;

async function waitForLock(descriptor: number, lockFile: string, waitMs: number): Promise<void> {
  const libc = dlopen('libc.so.6', {
    flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
  });

  const deadline = Date.now() + waitMs;

  try {
    for (;;) {
      if (libc.symbols.flock(descriptor, LOCK_EXCLUSIVE | LOCK_NONBLOCKING) === 0) {
        return;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `another qa:chrome or qa:net command still holds ${lockFile} after ${waitMs} ms`,
        );
      }

      await Bun.sleep(POLL_INTERVAL_MS);
    }
  } finally {
    libc.close();
  }
}
