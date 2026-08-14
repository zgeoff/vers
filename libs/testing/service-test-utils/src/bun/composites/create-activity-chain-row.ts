import type { ActivityChains, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockActivityChain } from '../factories/create-mock-activity-chain';

interface CreateActivityChainRowData extends Partial<Insertable<ActivityChains>> {
  readonly avatarId: string;
  readonly scopeId: string;
}

/**
 * Seeds a revealed chain row for an existing avatar and scope — the precondition `startActivity`
 * requires before it will root a new activity there, mirroring what `revealNodes` mints at reveal
 * time.
 */
export function createActivityChainRow(
  db: Kysely<DB>,
  data: Readonly<CreateActivityChainRowData>,
): Promise<Selectable<ActivityChains>> {
  const row = createMockActivityChain(data);

  return db.insertInto('activityChains').values(row).returningAll().executeTakeFirstOrThrow();
}
