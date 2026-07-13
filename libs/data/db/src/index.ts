export { createDB } from './create-db';
export { migrateToLatest, migrationsFolder } from './migrate-to-latest';

export type {
  Activities,
  ActivityChains,
  ActivityCheckpoints,
  ActivityStatus,
  AvatarGrants,
  Avatars,
  ConsumedTransactionTokens,
  DB,
  Json,
  PendingTransactions,
  Sessions,
  Users,
  Verifications,
} from './schema.generated';
