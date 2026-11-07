import { readFile } from 'node:fs/promises';
import type { OfflineHoldPaths } from './types';

export async function readOfflineHoldFailures(paths: OfflineHoldPaths): Promise<string> {
  try {
    return await readFile(paths.logFile, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}
