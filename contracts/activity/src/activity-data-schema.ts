import * as z from 'zod';
import { ActivityStatusSchema } from './activity-status-schema';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { EncounterNodeSchema } from './encounter-node-schema';

/**
 * An activity stream's head row, as returned to callers.
 */
export const ActivityDataSchema = z.object({
  appendedAt: z.date().nullable(),
  appendedHead: z.int(),
  avatarID: z.string(),
  buildSnapshot: BuildSnapshotSchema,
  contentVersion: z.string(),
  createdAt: z.date(),
  encounterNode: EncounterNodeSchema,
  id: z.string(),
  keyVersion: z.int().min(1),
  lastHash: z.string(),
  scopeID: z.string(),
  scopeType: z.string(),
  seed: z.string(),
  simVersion: z.string(),
  startChainIndex: z.int().min(0),
  startHash: z.string(),

  /**
   * The idempotency key the start request stamped, null for rows minted without one — echoed so
   * a row and the data derived from it stay field-identical.
   */
  startKey: z.string().nullable(),

  startedAt: z.date(),
  status: ActivityStatusSchema,
  stoppedAt: z.date().nullable(),
  updatedAt: z.date(),
  verifiedAt: z.date().nullable(),
  verifiedHead: z.int(),
});

export type ActivityData = z.infer<typeof ActivityDataSchema>;
