import type { TokenIssuer } from '@vers/service-auth';
import { TOKEN_ALGORITHM } from '@vers/service-auth';
import type { CryptoKey } from 'jose';
import * as jose from 'jose';

interface CreateServiceTokenOptions {
  readonly actingSessionID?: string;
  readonly actingUserID?: string;
  readonly audience: string;
  readonly expiresIn?: string;
  readonly issuer?: TokenIssuer;
  readonly privateKey: CryptoKey;
}

export function createServiceToken(options: CreateServiceTokenOptions): Promise<string> {
  const issuer = options.issuer ?? 'app-web';

  const claims = {
    ...(options.actingUserID !== undefined && { sub: options.actingUserID }),
    ...(options.actingSessionID !== undefined && { sid: options.actingSessionID }),
  };

  const jwt = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: issuer })
    .setIssuer(issuer)
    .setAudience(options.audience)
    .setExpirationTime(options.expiresIn ?? '60s');

  return jwt.sign(options.privateKey);
}
