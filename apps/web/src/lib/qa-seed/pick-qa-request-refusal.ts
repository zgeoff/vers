import { createHash, timingSafeEqual } from 'node:crypto';
import type { QARequestRefusal } from './types';

export interface PickQARequestRefusalInput {
  readonly authorization: string | null;
  readonly configuredToken: string | undefined;
  readonly procedurePath: ReadonlyArray<string>;
}

const QA_PROCEDURE = 'createQAAccount';

export function pickQARequestRefusal(
  input: Readonly<PickQARequestRefusalInput>,
): QARequestRefusal | null {
  if (input.configuredToken === undefined) {
    return 'disabled';
  }

  if (!isQASeedToken(input.authorization, input.configuredToken)) {
    return 'unauthorized';
  }

  if (input.procedurePath.length !== 1 || input.procedurePath[0] !== QA_PROCEDURE) {
    return 'unknown-procedure';
  }

  return null;
}

const BEARER_PREFIX = 'Bearer ';

// comparing fixed-length digests keeps the comparison's time independent of the token's length
// and of how much of a guess matches
function isQASeedToken(authorization: string | null, configuredToken: string): boolean {
  if (authorization === null || !authorization.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const presented = authorization.slice(BEARER_PREFIX.length);

  return timingSafeEqual(hashToken(presented), hashToken(configuredToken));
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
