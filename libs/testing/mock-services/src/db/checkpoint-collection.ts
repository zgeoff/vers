import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { CheckpointSchema } from '@vers/contract-activity';
import * as z from 'zod';

/**
 * A stored mock checkpoint row: the public `CheckpointSchema` plus the stream it belongs to, with
 * every field defaulted. Hashes default to random hex — the mock backend stores what callers
 * append without re-deriving the chain.
 */
const CheckpointRowSchema = CheckpointSchema.extend({
  activityID: z.string().default(() => createId()),
  appendedAt: z.date().default(() => new Date()),
  hash: z.string().default(() => buildMockHash()),
  payload: CheckpointSchema.shape.payload.default(() => ({
    chainIndex: 0,
    entropySource: 'server-key' as const,
    nextSeed: buildMockHash().slice(0, 32),
    seed: buildMockHash().slice(0, 32),
    time: 0,
    type: 'tick',
  })),
  prevHash: z.string().default(() => buildMockHash()),
  version: z.int().min(1).default(1),
});

export const checkpointCollection = new Collection({ schema: CheckpointRowSchema });

function buildMockHash(): string {
  return faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });
}
