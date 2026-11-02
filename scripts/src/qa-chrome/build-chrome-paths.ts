import { join } from 'node:path';
import type { ChromePaths } from './types';

export function buildChromePaths(xdgStateHome: string | undefined, home: string): ChromePaths {
  const stateHome =
    xdgStateHome === undefined || xdgStateHome === ''
      ? join(home, '.local', 'state')
      : xdgStateHome;

  const directory = join(stateHome, 'vers', 'qa-chrome');

  return {
    directory,
    lockFile: join(directory, 'state.lock'),
    logFile: join(directory, 'chrome.log'),
    profileDir: join(directory, 'profile'),
    stateFile: join(directory, 'state.json'),
  };
}
