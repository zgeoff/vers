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

  /**
   * The scope secret ref and root version content sealing derived this activity's node content
   * from, null on a legacy row minted before sealing.
   */
  secretRef: z.string().nullable(),
  secretVersion: z.int().min(1).nullable(),

  simVersion: z.string(),
  startChainIndex: z.int().min(0),
  startHash: z.string(),

  /**
   * The start request's idempotency key, null when none was sent.
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
