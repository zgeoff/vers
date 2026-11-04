import { FFIType, dlopen } from 'bun:ffi';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function withFileLock<T>(
  lockFile: string,
  waitMs: number,
  run: () => Promise<T>,
): Promise<T> {
  await mkdir(dirname(lockFile), { recursive: true });

  const handle = await open(lockFile, 'a');

  // the kernel drops a flock when its descriptor closes, including when the process dies
  try {
    await waitForLock(handle.fd, lockFile, waitMs);

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
        throw new Error(`another command still holds ${lockFile} after ${waitMs} ms`);
      }

      await Bun.sleep(POLL_INTERVAL_MS);
    }
  } finally {
    libc.close();
  }
}
