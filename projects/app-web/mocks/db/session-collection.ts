import { Collection } from '@msw/data';
import { SessionDataSchema } from '@vers/contract-session';
import * as z from 'zod';

/** A stored mock session row: the public `SessionDataSchema` plus the token pair it gates. */
export const SessionRowSchema = SessionDataSchema.extend({
  previousRefreshToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
});

export const sessionCollection = new Collection({ schema: SessionRowSchema });
