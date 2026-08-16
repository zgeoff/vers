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

  /**
   * An advisory client-stamped wall-clock timestamp for operator and analytics queries only —
   * never read by the claim or any legality check. Null for a row minted before this field
   * existed.
   */
  playedAt: z.date().nullable(),

  /**
   * The avatar's immediately-prior activity across every chain, in the order the client played
   * them — null for the avatar's first-ever activity. The client stamps it at start; the server
   * trusts it for settlement sequencing only, never for legality.
   */
  predecessorActivityID: z.string().nullable(),

  scopeID: z.string(),
  scopeType: z.string(),
  seed: z.string(),

  /**
   * The scope secret ref and root version content sealing derived this activity's node content
   * from.
   */
  secretRef: z.string(),
  secretVersion: z.int().min(1),

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
