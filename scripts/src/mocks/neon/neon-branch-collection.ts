import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { z } from 'zod';

export const NeonBranchRowSchema = z.object({
  createdAt: z.date().default(() => new Date()),
  expiresAt: z.string().nullable().default(null),
  id: z.string().default(() => `br-${faker.string.alphanumeric({ casing: 'lower', length: 16 })}`),
  name: z.string().default(() => faker.word.noun()),
  parentID: z.string().nullable().default(null),
  projectID: z.string().default(() => faker.string.alphanumeric({ casing: 'lower', length: 12 })),
});

export const neonBranchCollection = new Collection({ schema: NeonBranchRowSchema });
