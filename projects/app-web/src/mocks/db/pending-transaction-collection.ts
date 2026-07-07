import { Collection } from '@msw/data';
import { PendingTransactionDataSchema } from '@vers/contract-session';

export const pendingTransactionCollection = new Collection({
  schema: PendingTransactionDataSchema,
});
