import { join } from 'node:path';

export function buildStateHome(xdgStateHome: string | undefined, home: string): string {
  return xdgStateHome === undefined || xdgStateHome === ''
    ? join(home, '.local', 'state')
    : xdgStateHome;
}
