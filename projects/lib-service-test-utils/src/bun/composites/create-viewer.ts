import type { DB, Users } from '@vers/db';
import { createServiceToken } from '@vers/service-runtime/test-utils';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createTestUser } from '../create-test-user';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';

interface CreateViewerConfig {
  readonly audience: string;
  readonly db: Kysely<DB>;
  readonly user?: Partial<Insertable<Users>>;
}

/** A persisted, s2s-authenticated acting user: a token and the user it was minted for. */
export async function createViewer(
  config: Readonly<CreateViewerConfig>,
): Promise<{ token: string; user: Selectable<Users> }> {
  const keyPair = await getTestServiceKeyPair();
  const created = await createTestUser(config.db, config.user);

  const token = await createServiceToken({
    actingUserId: created.user.id,
    audience: config.audience,
    privateKey: keyPair.privateKey,
  });

  return { token, user: created.user };
}
