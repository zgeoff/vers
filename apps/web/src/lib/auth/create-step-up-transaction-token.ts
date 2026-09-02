import { createId } from '@paralleldrive/cuid2';
import type { SecureAction } from '@vers/contract-session';
import { SecureActionSchema } from '@vers/contract-session';
import * as jose from 'jose';

const TRANSACTION_TOKEN_TTL_MS = 5 * 60 * 1000;
const TRANSACTION_TOKEN_ISSUER = 'vers-web-step-up';

interface StepUpTransactionClaims {
  readonly action: SecureAction;
  readonly expiresAt: Date;
  readonly jti: string;
  readonly sessionID: string | null;
  readonly target: string;
}

interface MintedStepUpTransactionToken {
  readonly expiresAt: Date;
  readonly jti: string;
  readonly token: string;
}

export async function createStepUpTransactionToken(
  claims: Readonly<Pick<StepUpTransactionClaims, 'action' | 'sessionID' | 'target'>>,
): Promise<MintedStepUpTransactionToken> {
  const keyPair = await getStepUpTransactionKeyPair();

  const jti = createId();

  const expiresAt = new Date(Date.now() + TRANSACTION_TOKEN_TTL_MS);

  const token = await new jose.SignJWT({
    action: claims.action,
    sessionID: claims.sessionID,
    target: claims.target,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(TRANSACTION_TOKEN_ISSUER)
    .setAudience(TRANSACTION_TOKEN_ISSUER)
    .setExpirationTime(expiresAt)
    .sign(keyPair.privateKey);

  return { expiresAt, jti, token };
}

export async function verifyStepUpTransactionToken(
  token: string,
): Promise<StepUpTransactionClaims> {
  const keyPair = await getStepUpTransactionKeyPair();

  const verifyResult = await jose.jwtVerify(token, keyPair.publicKey, {
    algorithms: ['RS256'],
    audience: TRANSACTION_TOKEN_ISSUER,
    issuer: TRANSACTION_TOKEN_ISSUER,
  });

  const payload = verifyResult.payload;

  if (payload.exp === undefined) {
    throw new Error('step-up transaction token is missing its "exp" claim');
  }

  return {
    action: SecureActionSchema.parse(payload['action']),
    expiresAt: new Date(payload.exp * 1000),
    jti: getRequiredStringClaim(payload, 'jti'),
    sessionID: getSessionIDClaim(payload),
    target: getRequiredStringClaim(payload, 'target'),
  };
}

function getRequiredStringClaim(payload: jose.JWTPayload, key: 'jti' | 'target'): string {
  const value = payload[key];

  if (typeof value !== 'string') {
    throw new TypeError(`step-up transaction token is missing its "${key}" claim`);
  }

  return value;
}

function getSessionIDClaim(payload: jose.JWTPayload): string | null {
  const value = payload['sessionID'];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new TypeError('step-up transaction token is missing its "sessionID" claim');
  }

  return value;
}

let keyPairPromise: Promise<{ privateKey: jose.CryptoKey; publicKey: jose.CryptoKey }> | null =
  null;

function getStepUpTransactionKeyPair(): Promise<{
  privateKey: jose.CryptoKey;
  publicKey: jose.CryptoKey;
}> {
  keyPairPromise ??= createStepUpTransactionKeyPair();

  return keyPairPromise;
}

async function createStepUpTransactionKeyPair(): Promise<{
  privateKey: jose.CryptoKey;
  publicKey: jose.CryptoKey;
}> {
  const pair = await jose.generateKeyPair('RS256');

  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}
