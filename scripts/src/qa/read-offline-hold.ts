import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { readProcessStartTime } from '../qa-chrome/read-process-start-time';
import type { OfflineHold, OfflineHoldPaths } from './types';

const offlineHoldSchema = z.object({ pid: z.number().int().positive(), startTime: z.string() });

export async function readOfflineHold(paths: OfflineHoldPaths): Promise<OfflineHold | undefined> {
  const text = await readFile(paths.stateFile, 'utf8').catch((error: unknown) => {
    if (isMissingFile(error)) {
      return;
    }

    throw error;
  });

  if (text === undefined) {
    return undefined;
  }

  const hold = offlineHoldSchema.parse(JSON.parse(text));

  // a hold that ended with its target leaves its file behind, and the kernel can hand its process
  // ID to a new process, which has another start time
  const startTime = await readProcessStartTime(hold.pid);

  return startTime === hold.startTime ? hold : undefined;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
