import { Collection } from '@msw/data';
import { EncounterContentSchema, LootTablesSchema } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import * as z from 'zod';

/**
 * The content version a mock row stamps or resolves when a test states none — mirrors the real
 * registry's current version, so MSW-backed client tests resolve content through the real
 * dispatch without seeding.
 */
export const MOCK_CURRENT_CONTENT_VERSION = '2';

/**
 * A stored mock content document keyed by `contentVersion`. Defaults describe one coherent
 * document at the mock current version; a row stored under any other version must carry an
 * encounter and loot table pinned to that same version, which the factory produces from a single
 * `contentVersion` override.
 */
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
