import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { UserDataSchema } from '@vers/contract-user';
import * as z from 'zod';

export const UserRowSchema = UserDataSchema.extend({
  createdAt: z.date().default(() => new Date()),
  email: z.string().default(() => faker.internet.email()),
  id: z.string().default(() => createId()),
  name: z.string().default(() => faker.person.fullName()),
  password: z.string().default(() => faker.internet.password()),
  passwordResetToken: z.string().nullable().default(null),
  passwordResetTokenExpiresAt: z.date().nullable().default(null),
  seed: z.int().default(() => faker.number.int({ max: 1000 })),
  updatedAt: z.date().default(() => new Date()),
  username: z.string().default(() => faker.internet.username()),
});

export const userCollection = new Collection({ schema: UserRowSchema });
