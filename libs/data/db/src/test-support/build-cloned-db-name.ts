import { createId } from '@paralleldrive/cuid2';

// the owner tag and process id in the name let a later run's sweep drop only the clones whose
// process is gone, never a clone a live worker still holds open
export function buildClonedDBName(ownerPrefix: string): string {
  return `${ownerPrefix}${process.pid}_${createId()}`;
}
