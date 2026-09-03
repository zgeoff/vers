import type { DB, Users } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createServiceToken } from '../create-service-token';
import { createTestUser } from '../create-test-user';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';

interface CreateViewerConfig {
  readonly audience: string;
  readonly db: Kysely<DB>;
  readonly sessionID?: string;
  readonly user?: Partial<Insertable<Users>>;
}

export async function createViewer(
  config: Readonly<CreateViewerConfig>,
): Promise<{ token: string; user: Selectable<Users> }> {
  const keyPair = await getTestServiceKeyPair();
  const created = await createTestUser(config.db, config.user);

  const token = await createServiceToken({
    actingUserID: created.user.id,
    audience: config.audience,
    privateKey: keyPair.privateKey,
    ...(config.sessionID !== undefined && { actingSessionID: config.sessionID }),
  });

  return { token, user: created.user };
}
