import * as z from 'zod';
import { ActivityStatusSchema } from './activity-status-schema';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { EncounterNodeSchema } from './encounter-node-schema';

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

  playedAt: z.date().nullable(),

  predecessorActivityID: z.string().nullable(),

  scopeID: z.string(),
  scopeType: z.string(),
  seed: z.string(),

  secretRef: z.string(),
  secretVersion: z.int().min(1),

  simVersion: z.string(),
  startChainIndex: z.int().min(0),
  startHash: z.string(),

  startKey: z.string().nullable(),

  startedAt: z.date(),
  status: ActivityStatusSchema,
  stoppedAt: z.date().nullable(),
  updatedAt: z.date(),
  verifiedAt: z.date().nullable(),
  verifiedHead: z.int(),
});

export type ActivityData = z.infer<typeof ActivityDataSchema>;
