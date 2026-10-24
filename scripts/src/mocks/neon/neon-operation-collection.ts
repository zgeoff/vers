import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { z } from 'zod';

export const NeonOperationRowSchema = z.object({
  action: z.string().default('create_branch'),
  branchID: z
    .string()
    .default(() => `br-${faker.string.alphanumeric({ casing: 'lower', length: 16 })}`),
  id: z.string().default(() => faker.string.uuid()),
  projectID: z.string().default(() => faker.string.alphanumeric({ casing: 'lower', length: 12 })),
  status: z.string().default('finished'),
});

export const neonOperationCollection = new Collection({ schema: NeonOperationRowSchema });
