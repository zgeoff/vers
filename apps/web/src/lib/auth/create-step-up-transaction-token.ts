import { createId } from '@paralleldrive/cuid2';
import type { SecureAction } from '@vers/contract-session';
import { SecureActionSchema } from '@vers/contract-session';
import * as jose from 'jose';

/**
 * How long a minted step-up transaction token stays redeemable.
 */
const TRANSACTION_TOKEN_TTL_MS = 5 * 60 * 1000;
const TRANSACTION_TOKEN_ISSUER = 'vers-web-step-up';

/**
 * Claims a step-up transaction token carries; `jti` is its single-use replay-guard id.
 */
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

/**
 * Mints an RS256 step-up transaction token: proof that a pending transaction's code check
 * already passed, redeemable once by the gated mutation it names. Minted and verified only in
 * this app's own server functions — the durable pending-transaction state lives in the session
 * service, but the token itself never leaves the edge.
 */
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

/**
 * Verifies a step-up transaction token's signature and expiry, returning its claims.
 */
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

/**
 * Lazily generates this process's step-up signing keypair. Minting and verifying always happen in
 * the same edge process a token was issued from, so a fresh in-memory keypair per process is
 * enough — no durable key storage needed.
 */
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
