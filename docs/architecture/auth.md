# Auth

Authentication and step-up authorization split across three domain services and the app-web edge.
The edge (`apps/web`) runs the credential and code flows, holds the session cookie, and mints every
service-to-service token. Durable state lives in the services: sessions and step-up transactions in
`service-session`, password credentials and reset tokens in `service-user`, TOTP verifications in
`service-verification`. Services never see cookies — the edge validates the session and mints a
short-lived token naming the acting user (`docs/architecture/service-contracts.md`).

## Session lifecycle

A login runs in the edge's `runLogin` (`apps/web/src/routes/-login/`):

1. Honeypot and field validation, then `userClient.getUser` and `userClient.verifyPassword`. A wrong
   email or password reports one form-level error, never which was wrong.
2. `sessionClient.createSession` writes an unverified session row — expiry 24 hours, or 7 days with
   `rememberMe`.
3. With 2FA on the account, redirect to `/verify-otp` carrying the pending session id; otherwise
   `runSessionSignIn` runs directly.

`runSessionSignIn` (`apps/web/src/lib/auth/`) redirects to a force-logout prompt when the account
already holds a live session; otherwise it calls `verifySession` and seals the cookie.
`verifySession` (`services/session/src/handlers/`) mints the first access/refresh pair, flips the
row to `verified`, and evicts every other session of the same user in one CTE — at most one verified
session per user. Access tokens live 15 minutes and rotate through `refreshTokens`, which rejects a
reused refresh token.

The cookie is `en_session` — httpOnly, `SameSite=Lax`, secure in production, sealed by an app secret
(`buildAuthSessionConfig`). `getAuthSession` reads it and never throws: an absent token is how
`requireAuth` and `requireAnonymous` observe "signed out".

## Step-up authorization

A sensitive mutation (email change, password change, disabling 2FA) demands a fresh code check
before it runs. `checkStepUp` (`apps/web/src/lib/auth/`) decides:

1. No live 2FA verification for the target — not needed; the mutation proceeds.
2. A valid, unused transaction token on the resubmission — verified; the mutation proceeds.
3. Otherwise — create a pending transaction and challenge the caller for a code.

The challenge submits to `verifyStepUpHandler`, shared by every gated mutation: `verifyCode` checks
the submitted TOTP; an invalid code counts a failed attempt against the pending transaction, and the
transaction is abandoned after 5 (`recordFailedAttempt`); a valid code atomically consumes the
pending transaction and mints a transaction token.

State that outlives a request lives in postgres, in the `pending_transactions` table. A pending
transaction holds its action, target, IP, and owning session (cascade-deleted with the session) and
expires after 5 minutes; `consumePendingTransaction` rejects a request whose action, IP, session, or
target does not match the stored row.

The transaction token is an RS256 JWT minted and verified only inside the edge process
(`create-step-up-transaction-token.ts`) — proof a code check passed, redeemable once by the mutation
it names. It carries `action`, `target`, `sessionID`, and a `jti`, lives 5 minutes, and signs
against a per-process in-memory keypair, since it never leaves the process that issued it. Single
use is enforced by the `consumed_transaction_tokens` ledger: `consumeTransactionToken` records the
`jti`, and a token whose `jti` is already recorded is rejected. `checkStepUp` also matches the
token's `sessionID` before consuming it, so a token minted under one session cannot redeem under
another.

## TOTP verification

`service-verification` issues and checks TOTP codes with `@epic-web/totp`, one verification row per
target and type (`2fa`, `2fa-setup`, `change-email`, `onboarding`):

- `createVerification` generates a code and returns the OTP.
- `verifyCode` checks it. `change-email` and `onboarding` codes are consumed on success (the row is
  deleted); `2fa` and `2fa-setup` codes stay and are marked verified, each guarded so a replay
  matches zero rows.
- `get2FAVerificationURI` returns the authenticator-app URI for a pending 2FA setup.

## Password reset

`service-user` owns the credential path: `verifyPassword` gates login, while `changePassword` and
`resetPassword` rewrite the hash and sign the user out of every session. A reset token is stored as
its sha256 hash and reaches the user only through the URL in the reset email; `resetPassword`
matches it in constant time.

## Service-to-service tokens

Every outbound service call from the edge carries a short-lived JWT from `createServiceToken`
(`@vers/service-auth`): EdDSA, issuer `vers-edge`, audience the target service, `sub` the acting
user (omitted for a verified-anonymous call), 60-second default expiry. The edge signs with
`SERVICE_AUTH_PRIVATE_KEY` (`createEdgeServiceToken`); each service verifies with the public key in
its runtime middleware before any handler runs, rejecting a bad token with a plain 401.
