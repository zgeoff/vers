import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { SessionDataSchema } from '@vers/contract-session';
import * as z from 'zod';

/**
 * A stored mock session row: the public `SessionDataSchema` plus the token pair it gates. The
 * defaults describe a live, verified session; tests state only the fields they assert on.
 */
export const SessionRowSchema = SessionDataSchema.extend({
  createdAt: z.date().default(() => new Date()),
  expiresAt: z.date().default(() => faker.date.soon()),
  id: z.string().default(() => createId()),
  ipAddress: z.string().default(() => faker.internet.ipv4()),
  previousRefreshToken: z.string().nullable().default(null),
  refreshToken: z
    .string()
    .nullable()
    .default(() => faker.string.alphanumeric(32)),
  updatedAt: z.date().default(() => new Date()),
  userID: z.string().default(() => createId()),
  verified: z.boolean().default(true),
});

export const sessionCollection = new Collection({ schema: SessionRowSchema });
