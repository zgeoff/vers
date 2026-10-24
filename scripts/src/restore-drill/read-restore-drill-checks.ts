import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { readChainAnchorChecks } from './read-chain-anchor-checks';
import { readItemIdentityChecks } from './read-item-identity-checks';
import { readSessionChecks } from './read-session-checks';
import { readSimVersionChecks } from './read-sim-version-checks';
import { readVerifiedProgressChecks } from './read-verified-progress-checks';
import type { RestoreDrillCheck } from './types';

export function readRestoreDrillChecks(db: Kysely<DB>): Promise<ReadonlyArray<RestoreDrillCheck>> {
  // one repeatable-read snapshot, so every check reads the same restored state, and read only, so
  // a connection string pointed at a live branch can never change it
  return db
    .transaction()
    .setIsolationLevel('repeatable read')
    .setAccessMode('read only')
    .execute(async (trx) => {
      const areas = await Promise.all([
        readSessionChecks(trx),
        readChainAnchorChecks(trx),
        readVerifiedProgressChecks(trx),
        readItemIdentityChecks(trx),
        readSimVersionChecks(trx),
      ]);

      return areas.flat();
    });
}
