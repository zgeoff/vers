import { readFile } from 'node:fs/promises';
import { parseChromeState } from './parse-chrome-state';
import { readProcessStartTime } from './read-process-start-time';
import type { ChromePaths, ChromeState } from './types';

export async function readChromeState(paths: ChromePaths): Promise<ChromeState | undefined> {
  const text = await readFile(paths.stateFile, 'utf8').catch((error: unknown) => {
    if (isMissingFile(error)) {
      return;
    }

    throw error;
  });

  if (text === undefined) {
    return undefined;
  }

  const state = parseChromeState(text);

  // a process ID that the kernel handed to a new process after the browser exited has another
  // start time, so a stale file never points a stop at someone else's process group
  const startTime = await readProcessStartTime(state.leaderPID);

  return startTime === state.leaderStartTime ? state : undefined;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
