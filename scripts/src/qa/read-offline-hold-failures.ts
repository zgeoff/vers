import { readFile } from 'node:fs/promises';
import type { OfflineHoldPaths } from './types';

export async function readOfflineHoldFailures(paths: OfflineHoldPaths): Promise<string> {
  try {
    return await readFile(paths.logFile, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return '';
    }

    const message = error instanceof Error ? error.message : String(error);

    return `could not read the hold's failure log: ${message}\n`;
  }
}
