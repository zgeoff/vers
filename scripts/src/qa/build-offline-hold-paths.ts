import { join } from 'node:path';
import { buildStateHome } from '../utils/build-state-home';
import type { OfflineHoldPaths } from './types';

export function buildOfflineHoldPaths(
  xdgStateHome: string | undefined,
  home: string,
  targetID: string,
): OfflineHoldPaths {
  const directory = join(buildStateHome(xdgStateHome, home), 'vers', 'qa-cdp', 'offline');

  return { directory, stateFile: join(directory, `${encodeURIComponent(targetID)}.json`) };
}
