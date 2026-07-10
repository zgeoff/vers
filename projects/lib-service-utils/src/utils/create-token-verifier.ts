import * as jose from 'jose';
import invariant from 'tiny-invariant';

export interface TokenVerifierConfig {
  readonly audience: string;
  readonly issuer: string;
  readonly spkiKey: string;
}

export interface RelevantJWTPayload {
  readonly iss: string | undefined;
  readonly sub: string;
}

export function createTokenVerifier(config: TokenVerifierConfig) {
  return async (token: string): Promise<RelevantJWTPayload> => {
    const publicKey = await jose.importSPKI(config.spkiKey, 'RS256');

    const verifyResult = await jose.jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
      audience: config.audience,
      issuer: config.issuer,
    });

    invariant(typeof verifyResult.payload.sub === 'string', 'sub must be in JWT payload');

    return {
      iss: verifyResult.payload.iss,
      sub: verifyResult.payload.sub,
    };
  };
}
