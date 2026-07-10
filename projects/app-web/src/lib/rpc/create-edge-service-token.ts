import * as jose from 'jose';
import { env } from '../../server/env';
import type { ServiceName } from './service-urls';

// the issuer and algorithm the services verify s2s tokens against
const ISSUER = 'vers-edge';
const ALGORITHM = 'EdDSA';

// imported once at module scope, not per call: every mint reuses this same resolved key
const privateKey = jose.importPKCS8(env.SERVICE_AUTH_PRIVATE_KEY, ALGORITHM);

interface CreateEdgeServiceTokenOptions {
  readonly actingUserID: string | null;
  readonly audience: ServiceName;
}

/**
 * Mints the 60s s2s token every outbound service call carries, signed with this app's edge key.
 * `actingUserID` becomes the token's `sub` claim; `null` mints a verified-anonymous token instead.
 */
export async function createEdgeServiceToken(
  options: Readonly<CreateEdgeServiceTokenOptions>,
): Promise<string> {
  const jwt = new jose.SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(options.audience)
    .setExpirationTime('60s');

  if (options.actingUserID !== null) {
    jwt.setSubject(options.actingUserID);
  }

  const key = await privateKey;

  return jwt.sign(key);
}
