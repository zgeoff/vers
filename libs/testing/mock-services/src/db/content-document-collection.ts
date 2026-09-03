import { Collection } from '@msw/data';
import { EncounterContentSchema, LootTablesSchema } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import * as z from 'zod';

export const MOCK_CURRENT_CONTENT_VERSION = '2';

const ContentDocumentRowSchema = z.object({
  contentVersion: z.string().default(MOCK_CURRENT_CONTENT_VERSION),
  encounter: EncounterContentSchema.default(
    () => createMockContentDocument({ contentVersion: MOCK_CURRENT_CONTENT_VERSION }).encounter,
  ),
  loot: LootTablesSchema.default(
    () => createMockContentDocument({ contentVersion: MOCK_CURRENT_CONTENT_VERSION }).loot,
  ),
});

export const contentDocumentCollection = new Collection({ schema: ContentDocumentRowSchema });
