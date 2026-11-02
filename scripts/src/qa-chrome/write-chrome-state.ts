import { mkdir, writeFile } from 'node:fs/promises';
import type { ChromePaths, ChromeState } from './types';

export async function writeChromeState(paths: ChromePaths, state: ChromeState): Promise<void> {
  await mkdir(paths.directory, { recursive: true });
  await writeFile(paths.stateFile, `${JSON.stringify(state, null, 2)}\n`);
}
