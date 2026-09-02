import * as z from 'zod';
import { EncounterContentSchema } from './encounter-content-schema';
import { LootTablesSchema } from './loot-tables-schema';

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
