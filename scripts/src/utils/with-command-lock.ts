import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { withFileLock } from '@zgeoff/std/with-file-lock';

export async function withCommandLock<T>(
  lockFile: string,
  waitMs: number,
  run: () => Promise<T>,
): Promise<T> {
  await mkdir(dirname(lockFile), { recursive: true });

  const result = await withFileLock(lockFile, run, { waitMs });

  if (result.kind === 'busy') {
    throw new Error(`another command still holds ${lockFile} after ${waitMs} ms`);
  }

  return result.value;
}
