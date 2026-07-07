import { Collection } from '@msw/data';
import { UserDataSchema } from '@vers/contract-user';
import * as z from 'zod';

/** A stored mock user row: the public `UserDataSchema` plus the mock backend's own password check. */
export const UserRowSchema = UserDataSchema.extend({ password: z.string() });

export const userCollection = new Collection({ schema: UserRowSchema });
