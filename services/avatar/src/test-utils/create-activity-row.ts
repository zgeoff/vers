import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Activities, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';

interface CreateActivityRowData extends Partial<Insertable<Activities>> {
  readonly avatarId: string;
}

/**
 * Seeds an activity head row for an existing avatar — the live-activity guard tests need a real
 * `status = 'active'` row. Hash and content fields default to opaque strings: the guard reads
 * status and ownership, never the chain.
 */
export function createActivityRow(
  db: Kysely<DB>,
  data: Readonly<CreateActivityRowData>,
): Promise<Selectable<Activities>> {
  const startHash = faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });

  return db
    .insertInto('activities')
    .values({
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: `act_${createId()}`,
      lastHash: startHash,
      scopeId: faker.string.alphanumeric({ casing: 'lower', length: 8 }),
      scopeType: 'world_map_node',
      seed: faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' }),
      simVersion: '0.0.0-dev',
      startHash,
      ...data,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
