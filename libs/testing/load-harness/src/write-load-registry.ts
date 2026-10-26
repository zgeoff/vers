import type { DB } from '@vers/db';
import { upsertSimVersion } from '@vers/sim-registry';
import type { Kysely } from 'kysely';
import type { LoadEngineVersions } from './types';

const RETENTION_DAYS = 3;

// the rows the deploy CLI's sim-version reconcile writes on Fly: the retained version's row points
// at its own provider, and the current one, registered last, is the version admission stamps
export async function writeLoadRegistry(
  db: Kysely<DB>,
  versions: Readonly<LoadEngineVersions>,
): Promise<void> {
  const content = await db
    .selectFrom('contentCurrent')
    .select('contentVersion')
    .executeTakeFirstOrThrow();

  await upsertSimVersion(db, {
    bunVersion: Bun.version,
    engineHash: versions.retained,
    imageRef: 'load-stack/retained',
    maxContentVersion: content.contentVersion,
    providerURL: 'http://service-replay-retained:3000',
    retentionDays: RETENTION_DAYS,
  });

  await upsertSimVersion(db, {
    bunVersion: Bun.version,
    engineHash: versions.current,
    imageRef: 'load-stack/current',
    maxContentVersion: content.contentVersion,
    providerURL: 'http://service-replay:3000',
    retentionDays: RETENTION_DAYS,
  });
}
