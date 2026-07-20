import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { ActivityDataSchema, EncounterNodeSchema } from '@vers/contract-activity';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import * as z from 'zod';

/**
 * A stored mock activity row: the public `ActivityDataSchema` with every field defaulted, so
 * tests state only the fields they assert on. `avatarID` defaults to a random id, not a real
 * avatar's, and hashes default to random hex rather than a real chain digest.
 */
const ActivityRowSchema = ActivityDataSchema.extend({
  appendedAt: z.date().nullable().default(null),
  appendedHead: z.int().default(0),
  avatarID: z.string().default(() => createId()),
  buildSnapshot: z.object({ level: z.int(), xp: z.int() }).default({ level: 1, xp: 0 }),
  contentVersion: z.string().default(CURRENT_CONTENT_VERSION),
  createdAt: z.date().default(() => new Date()),
  encounterNode: EncounterNodeSchema.default({ difficulty: 1 }),
  id: z.string().default(() => `act_${createId()}`),
  keyVersion: z.int().min(1).default(1),
  lastHash: z.string().default(() => buildMockHash()),
  scopeID: z.string().default('esaxrt'),
  scopeType: z.string().default('world_map_node'),
  seed: z.string().default(() => buildMockHash().slice(0, 32)),
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

function buildMockHash(): string {
  return faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });
}
