import { applyMigrations, createDB } from '@vers/db';
import { upsertSimVersion } from '@vers/sim-registry';
import { localEngineHash } from './build-stack-env';

// Migrates the empty database, then registers the local engine hash as the active sim version for
// the current content, so the activity service admits a start that the local web build stamps.
export async function runDatabaseSetup(databaseURL: string): Promise<void> {
  const migrated = await applyMigrations({ databaseURL });

  if (migrated.error !== undefined) {
    throw new Error('the local database did not migrate', { cause: migrated.error });
  }

  const db = createDB({ databaseURL });

  try {
    const content = await db
      .selectFrom('contentCurrent')
      .select('contentVersion')
      .executeTakeFirstOrThrow();

    await upsertSimVersion(db, {
      bunVersion: Bun.version,
      engineHash: localEngineHash,
      imageRef: 'local',
      maxContentVersion: content.contentVersion,
      providerURL: 'http://127.0.0.1:1',
      retentionDays: 30,
    });
  } finally {
    await db.destroy();
  }
}
