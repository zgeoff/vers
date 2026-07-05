import * as jose from 'jose';
import invariant from 'tiny-invariant';

export interface TokenVerifierConfig {
  audience: string;
  issuer: string;
  spkiKey: string;
}

interface RelevantJWTPayload {
  iss: string | undefined;
  sub: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createTokenVerifier(config: TokenVerifierConfig) {
  return async (token: string): Promise<RelevantJWTPayload> => {
    const publicKey = await jose.importSPKI(config.spkiKey, 'RS256');

    const { payload } = await jose.jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
      audience: config.audience,
      issuer: config.issuer,
    });

    invariant(typeof payload.sub === 'string', 'sub must be in JWT payload');

    return {
      iss: payload.iss,
      sub: payload.sub,
    };
  };
}
