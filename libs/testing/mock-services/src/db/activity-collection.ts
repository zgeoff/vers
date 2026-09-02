import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { ActivityDataSchema, EncounterNodeSchema } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import * as z from 'zod';
import {
  MOCK_CURRENT_CONTENT_VERSION,
  contentDocumentCollection,
} from './content-document-collection';

const ActivityRowSchema = z.object({
  ...ActivityDataSchema.shape,
  appendedAt: z.date().nullable().default(null),
  appendedHead: z.int().default(0),
  avatarID: z.string().default(() => createId()),
  buildSnapshot: z.object({ level: z.int(), xp: z.int() }).default({ level: 1, xp: 0 }),
  contentVersion: z.string().default(MOCK_CURRENT_CONTENT_VERSION),
  createdAt: z.date().default(() => new Date()),
  encounterNode: EncounterNodeSchema.default({ difficulty: 1 }),
  id: z.string().default(() => `act_${createId()}`),
  keyVersion: z.int().min(1).default(1),
  lastHash: z.string().default(() => buildMockHash()),
  playedAt: z.date().nullable().default(null),
  predecessorActivityID: z.string().nullable().default(null),
  scopeID: z.string().default('1_0'),
  scopeType: z.string().default('world_map_node'),
  seed: z.string().default(() => buildMockHash().slice(0, 32)),
  secretRef: z.string().default('worldmap'),
  secretVersion: z.int().min(1).default(1),
  simVersion: z.string().default('0.0.0-mock'),
  startChainIndex: z.int().min(0).default(0),
  startHash: z.string().default(() => buildMockHash()),
  startKey: z.string().nullable().default(null),
  startedAt: z.date().default(() => new Date()),
  status: ActivityDataSchema.shape.status.default('active'),
  stoppedAt: z.date().nullable().default(null),
  updatedAt: z.date().default(() => new Date()),
  verifiedAt: z.date().nullable().default(null),
  verifiedHead: z.int().default(0),
});

export const activityCollection = new Collection({ schema: ActivityRowSchema });

// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return -- the hooks emitter awaits a listener's returned promise at runtime, so the backfill lands before the creating call resolves; only the listener's declared type says void
activityCollection.hooks.on('create', async (event) => {
  const contentVersion = event.data.record.contentVersion;
  const existing = contentDocumentCollection.findFirst((q) => q.where({ contentVersion }));

  if (existing === undefined) {
    await contentDocumentCollection.create(createMockContentDocument({ contentVersion }));
  }
});

function buildMockHash(): string {
  return faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });
}
