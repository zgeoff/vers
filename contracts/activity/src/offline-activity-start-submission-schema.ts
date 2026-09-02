import * as z from 'zod';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

export const OfflineActivityStartSubmissionSchema = z.object({
  avatarID: z.string(),
  buildSnapshot: BuildSnapshotSchema,
  contentVersion: z.string().regex(/^\d+$/),

  playedAt: z.date().nullable(),

  predecessorActivityID: z.string().nullable(),

  scopeID: ScopeIdentifierSchema,
  scopeType: ScopeIdentifierSchema,
  seed: z.string(),
  simVersion: z.string(),
  startChainIndex: z.int().min(0),
  startHash: z.string(),

  startKey: z.string().max(128),
});

export type OfflineActivityStartSubmission = z.infer<typeof OfflineActivityStartSubmissionSchema>;
