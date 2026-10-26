import type { Sessions } from '@vers/db';
import type { CryptoKey } from 'jose';
import type { Selectable } from 'kysely';

export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

export interface EmptyErrorPayload {
  readonly data: Record<string, never>;
}

export interface SessionSigningDeps {
  readonly apiIdentifier: string;
  readonly keyID: string;
  readonly signingKey: CryptoKey;
}

export type RefreshSessionState = Pick<
  Selectable<Sessions>,
  | 'createdAt'
  | 'expiresAt'
  | 'previousRefreshToken'
  | 'refreshToken'
  | 'rotationGraceUntil'
  | 'userId'
>;

export type RefreshDecision =
  | { readonly kind: 'expired' }
  | { readonly kind: 'grace'; readonly refreshToken: string; readonly userID: string }
  | { readonly kind: 'mismatch' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'renew'; readonly refreshToken: string; readonly userID: string }
  | { readonly kind: 'reuse' }
  | {
      readonly expiresAt: Date;
      readonly kind: 'rotate';
      readonly refreshToken: string;
      readonly userID: string;
    };

export type LostRotationDecision = Extract<
  RefreshDecision,
  { kind: 'expired' | 'grace' | 'reuse' }
>;
