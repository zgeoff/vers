import type { ContractRouterClient } from '@orpc/contract';
import type { AvatarContract } from '@vers/contract-avatar';
import { avatarContract } from '@vers/contract-avatar';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { DB, Users } from '@vers/db';
import { createService } from '@vers/service-runtime';
import { createServiceToken } from '@vers/service-runtime/test-utils';
import { createTestDB, createTestUser, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import type { Insertable, Kysely, Selectable } from 'kysely';
import * as z from 'zod';
import { buildAvatarRouter } from '../build-router';

interface SetupTestConfig {
  readonly user?: Partial<Insertable<Users>>;
}

/** The Elysia app any test can drive directly, for conformance-style checks against the raw router. */
interface RPCTestApp {
  readonly handle: (request: Request) => Promise<Response> | Response;
}

interface AvatarTestContext extends AsyncDisposable {
  readonly app: RPCTestApp;

  /**
   * Mints an RPC client authenticated as `userId` (the acting user by default). Pass another
   * user's id for cross-tenant cases, or `null` for an anonymous, session-less token.
   */
  readonly client: (userId?: null | string) => Promise<ContractRouterClient<AvatarContract>>;
  readonly db: Kysely<DB>;
  readonly user: Selectable<Users>;
}

/**
 * Builds a fully wired avatar-service test environment: a transaction-isolated db injected into a
 * real `createService` app, and a persisted acting user.
 */
export async function setupTest(config: SetupTestConfig = {}): Promise<AvatarTestContext> {
  const testDB = await createTestDB();
  const { privateKey } = await getTestServiceKeyPair();

  const { app } = await createService({
    buildRouter: () => buildAvatarRouter({ db: testDB.db }),
    contract: avatarContract,
    envShape: { DATABASE_URL: z.string() },
    name: 'service-avatar',
  });

  const { user } = await createTestUser(testDB.db, config.user);

  return {
    app,
    client: async (userId = user.id) => {
      const token = await createServiceToken({
        ...(userId !== null && { actingUserId: userId }),
        audience: 'service-avatar',
        privateKey,
      });

      return buildRPCTestClient<AvatarContract>(app, {
        headers: { authorization: `Bearer ${token}` },
      });
    },
    db: testDB.db,
    user,
    [Symbol.asyncDispose]: testDB[Symbol.asyncDispose],
  };
}
