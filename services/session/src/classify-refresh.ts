import { SESSION_DURATION_SHORT } from './consts';
import type { RefreshDecision, RefreshSessionState } from './types';

export function classifyRefresh(
  row: RefreshSessionState | undefined,
  token: string,
  now: Date,
): RefreshDecision {
  if (row === undefined) {
    return { kind: 'missing' };
  }

  if (row.expiresAt < now) {
    return { kind: 'expired' };
  }

  if (row.previousRefreshToken !== null && token === row.previousRefreshToken) {
    if (
      row.refreshToken !== null &&
      row.rotationGraceUntil !== null &&
      row.rotationGraceUntil > now
    ) {
      return { kind: 'grace', refreshToken: row.refreshToken, userID: row.userId };
    }

    return { kind: 'reuse' };
  }

  if (row.refreshToken === null || token !== row.refreshToken) {
    return { kind: 'mismatch' };
  }

  if (now.getTime() - row.createdAt.getTime() < SESSION_DURATION_SHORT) {
    return { kind: 'renew', refreshToken: row.refreshToken, userID: row.userId };
  }

  return {
    expiresAt: row.expiresAt,
    kind: 'rotate',
    refreshToken: row.refreshToken,
    userID: row.userId,
  };
}
