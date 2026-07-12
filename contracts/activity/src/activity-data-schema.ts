import * as z from 'zod';
import { ActivityStatusSchema } from './activity-status-schema';
import { BuildSnapshotSchema } from './build-snapshot-schema';

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
  id: z.string(),
  lastHash: z.string(),
  nodeID: z.string(),
  seed: z.string(),
  simVersion: z.string(),
  startChainIndex: z.int().min(0),
  startHash: z.string(),
  startedAt: z.date(),
  status: ActivityStatusSchema,
  stoppedAt: z.date().nullable(),
  updatedAt: z.date(),
  verifiedAt: z.date().nullable(),
  verifiedHead: z.int(),
});

export type ActivityData = z.infer<typeof ActivityDataSchema>;
