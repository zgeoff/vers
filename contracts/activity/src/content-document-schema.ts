import * as z from 'zod';
import { EncounterContentSchema } from './encounter-content-schema';
import { LootTablesSchema } from './loot-tables-schema';

/**
 * A published content version's full document: the version id plus every content domain pinned
 * to it. `encounter.contentVersion` and `loot.contentVersion` must both equal `contentVersion` —
 * a document is one atomic published unit, never a version mismatched against its own parts. The
 * version id is a numeric string: engine-content compatibility is decided by numeric comparison
 * against an engine's newest bundled version, so a non-numeric id could never be gated.
 */
export const ContentDocumentSchema = z
  .object({
    contentVersion: z.string().regex(/^\d+$/),
    encounter: EncounterContentSchema,
    loot: LootTablesSchema,
  })
  .readonly()
  .superRefine((value, ctx) => {
    if (value.encounter.contentVersion !== value.contentVersion) {
      ctx.addIssue({
        code: 'custom',
        message: 'encounter.contentVersion must equal contentVersion',
        path: ['encounter', 'contentVersion'],
      });
    }

    if (value.loot.contentVersion !== value.contentVersion) {
      ctx.addIssue({
        code: 'custom',
        message: 'loot.contentVersion must equal contentVersion',
        path: ['loot', 'contentVersion'],
      });
    }
  });

export type ContentDocument = z.infer<typeof ContentDocumentSchema>;
