import type { CryptoKey } from 'jose';
import * as jose from 'jose';

interface CreateJWTOpts {
  readonly apiIdentifier: string;
  readonly expiresAt: Date;
  readonly signingKey: CryptoKey;
  readonly userID: string;
}

/**
 * Mints an RS256 JWT for a session's access/refresh token, subject-bound to the owning user.
 */
export function createJWT(opts: CreateJWTOpts): Promise<string> {
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(opts.userID)
    .setIssuedAt()
    .setIssuer(opts.apiIdentifier)
    .setAudience(opts.apiIdentifier)
    .setExpirationTime(opts.expiresAt)
    .sign(opts.signingKey);
}
