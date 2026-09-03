import type { ServiceName } from '@vers/service-auth';
import { createServiceToken, parseServicePrivateKey } from '@vers/service-auth';
import { env } from '../../server/env';

const privateKey = parseServicePrivateKey(env.SERVICE_AUTH_PRIVATE_KEY);

interface CreateEdgeServiceTokenOptions {
  readonly actingSessionID?: string | null;
  readonly actingUserID: string | null;
  readonly audience: ServiceName;
}

export async function createEdgeServiceToken(
  options: Readonly<CreateEdgeServiceTokenOptions>,
): Promise<string> {
  return createServiceToken({
    audience: options.audience,
    issuer: 'app-web',
    privateKey: await privateKey,
    ...(options.actingUserID !== null && { actingUserID: options.actingUserID }),
    ...(options.actingSessionID !== null &&
      options.actingSessionID !== undefined && { actingSessionID: options.actingSessionID }),
  });
}
