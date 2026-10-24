import { createId } from '@paralleldrive/cuid2';
import { CLONED_DB_PREFIX } from './cloned-db-prefix';

// the owning process id in the name lets a later run's sweep drop only the clones whose process is
// gone, never a clone a live worker still holds open
export function buildClonedDBName(): string {
  return `${CLONED_DB_PREFIX}${process.pid}_${createId()}`;
}
