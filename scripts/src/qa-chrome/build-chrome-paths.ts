import { join } from 'node:path';
import { buildStateHome } from '../utils/build-state-home';
import type { ChromePaths } from './types';

export function buildChromePaths(xdgStateHome: string | undefined, home: string): ChromePaths {
  const directory = join(buildStateHome(xdgStateHome, home), 'vers', 'qa-chrome');

  return {
    directory,
    lockFile: join(directory, 'state.lock'),
    logFile: join(directory, 'chrome.log'),
    profileDir: join(directory, 'profile'),
    stateFile: join(directory, 'state.json'),
  };
}
