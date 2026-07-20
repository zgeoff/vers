import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { ActivityFailureActionSchema } from '@vers/contract-activity';
import { AvatarDataSchema, AvatarModeSchema } from '@vers/contract-avatar';
import * as z from 'zod';

/**
 * A stored mock avatar row: the public `AvatarDataSchema` with every field defaulted, so tests
 * state only the fields they assert on. `userID` defaults to a random id, not a real user's.
 * `failureAction` is the activity service's own column on this row, not part of the avatar
 * contract's public shape.
 */
export const AvatarRowSchema = AvatarDataSchema.extend({
  createdAt: z.date().default(() => new Date()),
  failureAction: ActivityFailureActionSchema.default('abort'),
  id: z.string().default(() => createId()),
  level: z.int().default(1),
  mode: AvatarModeSchema.default('trade'),
  name: z
    .string()
    .default(() => faker.string.alpha({ casing: 'lower', length: { max: 12, min: 6 } })),
  updatedAt: z.date().default(() => new Date()),
  userID: z.string().default(() => createId()),
  xp: z.int().default(0),
});

export const avatarCollection = new Collection({ schema: AvatarRowSchema });
