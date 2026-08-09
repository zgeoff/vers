import * as z from 'zod';
import { ActivityStatusSchema } from './activity-status-schema';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { EncounterNodeSchema } from './encounter-node-schema';

/**
 * An activity stream's head row, as returned to callers. `secretRef`/`secretVersion` are valid
 * only as a pair — both null on a legacy row, both set on a sealed one; a row carrying one without
 * the other could slip past the verifier's legacy-row gate, which keys on `secretRef` alone.
 */
export const ActivityDataSchema = z
  .object({
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
  })
  .refine((data) => (data.secretRef === null) === (data.secretVersion === null), {
    error: 'secretRef and secretVersion are null together or set together',
    path: ['secretVersion'],
  });

export type ActivityData = z.infer<typeof ActivityDataSchema>;
