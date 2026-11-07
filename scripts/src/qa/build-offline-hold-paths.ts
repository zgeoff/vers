import { join } from 'node:path';
import { buildStateHome } from '../utils/build-state-home';
import type { OfflineHoldPaths } from './types';

export function buildOfflineHoldPaths(
  xdgStateHome: string | undefined,
  home: string,
  targetID: string,
): OfflineHoldPaths {
  const directory = join(buildStateHome(xdgStateHome, home), 'vers', 'qa-cdp', 'offline');
  const fileStem = join(directory, encodeURIComponent(targetID));

  return {
    directory,
    lockFile: `${fileStem}.lock`,
    logFile: `${fileStem}.log`,
    stateFile: `${fileStem}.json`,
  };
}
