import type { ServiceName } from '@vers/service-auth';
import { createServiceToken, parseServicePrivateKey } from '@vers/service-auth';
import { env } from '../../server/env';

/**
 * Resolved once at module scope so every mint reuses this same key rather than re-parsing per call.
 */
const privateKey = parseServicePrivateKey(env.SERVICE_AUTH_PRIVATE_KEY);

interface CreateEdgeServiceTokenOptions {
  readonly actingSessionID?: string | null;
  readonly actingUserID: string | null;
  readonly audience: ServiceName;
}

/**
 * Mints the s2s token every outbound service call carries, signed with this app's edge key.
 * `actingUserID` becomes the token's `sub` claim; `null` mints a verified-anonymous token instead.
 * `actingSessionID` becomes the `sid` (writer-identity) claim; flows holding no live session omit
 * it.
 */
export async function createEdgeServiceToken(
  options: Readonly<CreateEdgeServiceTokenOptions>,
): Promise<string> {
  return createServiceToken({
    audience: options.audience,
    issuer: 'app-web',
    privateKey: await privateKey,
    ...(options.actingUserID !== null && { actingUserId: options.actingUserID }),
    ...(options.actingSessionID !== null &&
      options.actingSessionID !== undefined && { actingSessionId: options.actingSessionID }),
  });
}
