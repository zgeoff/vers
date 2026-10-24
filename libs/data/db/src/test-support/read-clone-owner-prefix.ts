import { createHash } from 'node:crypto';
import { readlinkSync } from 'node:fs';
import { hostname } from 'node:os';
import { CLONED_DB_PREFIX } from './cloned-db-prefix';

// a process id means nothing on another host or in another pid namespace, so the owner tag keeps
// one sweep away from the clones of every other host or container that shares the database server
export function readCloneOwnerPrefix(): string {
  const ownerTag = createHash('sha256')
    .update(`${hostname()}\n${readPIDNamespace()}`)
    .digest('hex')
    .slice(0, 8);

  return `${CLONED_DB_PREFIX}${ownerTag}_`;
}

// Linux names the namespace through procfs; elsewhere the host name alone tags the owner
function readPIDNamespace(): string {
  try {
    return readlinkSync('/proc/self/ns/pid');
  } catch {
    return '';
  }
}
