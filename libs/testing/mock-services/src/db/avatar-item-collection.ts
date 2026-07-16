import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

const AffixSchema = z.object({ affixID: z.string(), groupID: z.string(), value: z.number() });

/**
 * A stored mock minted-item row: one revealed reward-slot coordinate an activity settled at, with
 * every field defaulted so a seeding test states only what it asserts on. `avatarID`, `scopeType`,
 * and `scopeID` default to random values — a test reading rows back by scope sets them to match
 * the activity it seeded alongside.
 */
const AvatarItemRowSchema = z.object({
  affixes: z.array(AffixSchema).default(() => []),
  avatarID: z.string().default(() => createId()),
  baseID: z.string().default(() => `base_${faker.string.alpha({ casing: 'lower', length: 8 })}`),
  chainIndex: z.int().min(0).default(0),
  contentVersion: z.string().default('0.0.0-mock'),
  ordinal: z.int().min(0).default(0),
  rarityID: z.string().default('common'),
  scopeID: z.string().default(() => createId()),
  scopeType: z.string().default('node'),
});

export const avatarItemCollection = new Collection({ schema: AvatarItemRowSchema });
