// oxlint-disable zgeoff/seed-only -- direct table writes predate the rule; moving them behind the owner's `seed…` function is its own change

import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { SimVersionRow } from '../types';
import { createMockSimVersionRow } from './factories/create-mock-sim-version-row';

export function createSimVersionRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<SimVersionRow>> = {},
): Promise<SimVersionRow> {
  return db
    .insertInto('simVersions')
    .values(createMockSimVersionRow(overrides))
    .returningAll()
    .executeTakeFirstOrThrow();
}
