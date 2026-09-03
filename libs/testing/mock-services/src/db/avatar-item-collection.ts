import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

const AffixSchema = z.object({ affixID: z.string(), groupID: z.string(), value: z.number() });

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
