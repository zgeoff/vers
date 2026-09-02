# Auth

Authentication and step-up authorization split across three domain services and the app-web edge.
The edge (`apps/web`) runs the credential and code flows, holds the session cookie, and signs the
service-to-service (s2s) token for its own outbound calls. Durable state lives in the services:
sessions and step-up transactions in `service-session`, password credentials and reset tokens in
`service-user`, TOTP verifications in `service-verification`. Services never see cookies. The edge
validates the session and passes each service a short-lived token naming the acting user, so a
service trusts the token's claims and nothing else ([service contracts](./service-contracts.md)).

## Session lifecycle

A login runs in the edge's `runLogin` (`apps/web/src/routes/-login/`). It validates the honeypot and
fields, then calls `userClient.getUser` and `userClient.verifyPassword`. A wrong email or password
reports one form-level error, never which was wrong. `sessionClient.createSession` then writes an
unverified session row, expiring in 24 hours or 7 days with `rememberMe`. With 2FA on the account,
`runLogin` redirects to `/verify-otp` carrying the pending session id; without it,
`runSessionSignIn` runs directly.

`runSessionSignIn` (`apps/web/src/lib/auth/`) redirects to a force-logout prompt when the account
already holds a live session; otherwise it calls `verifySession` and seals the cookie.
`verifySession` (`services/session/src/handlers/`) mints the first access/refresh pair, flips the
row to `verified`, and evicts every other session of the same user in one CTE. At most one verified
session per user survives. Each token in the pair is an RS256 JWT subject-bound to the user, signed
with service-session's PKCS8 key (`JWT_SIGNING_PRIVKEY`). Its issuer and audience are both
`API_IDENTIFIER`. Access tokens live 15 minutes and rotate through `refreshTokens`, which rejects a
reused refresh token.

The cookie is `en_session`: httpOnly, `SameSite=Lax`, secure in production, sealed by an app secret
(`buildAuthSessionConfig`). `getAuthSession` reads it and never throws. An absent token is how
`requireAuth` and `requireAnonymous` observe "signed out".

## Step-up authorization

A sensitive mutation (an email change, a password change, or disabling 2FA) demands a fresh code
check before it runs. `checkStepUp` (`apps/web/src/lib/auth/`) decides in priority order. With no
live 2FA verification for the target, the check is not needed and the mutation proceeds. With a
valid, unused transaction token on the resubmission, the mutation proceeds. Otherwise `checkStepUp`
creates a pending transaction and challenges the caller for a code.

The challenge submits to `verifyStepUpHandler`, shared by every gated mutation. `verifyCode` checks
the submitted TOTP. An invalid code counts a failed attempt against the pending transaction, and
`recordFailedAttempt` abandons it after 5. A valid code atomically consumes the pending transaction
and mints a transaction token.

State that outlives a request lives in postgres, in the `pending_transactions` table. A pending
transaction holds its action, target, IP, and owning session; postgres cascade-deletes it with the
session, and it expires after 5 minutes. `consumePendingTransaction` rejects a request whose action,
IP, session, or target does not match the stored row.

The transaction token is an RS256 JWT minted and verified only inside the edge process
(`create-step-up-transaction-token.ts`). It is proof a code check passed, redeemable once by the
mutation it names. It carries `action`, `target`, `sessionID`, and a `jti`, and lives 5 minutes. It
signs against a per-process in-memory keypair, since it never leaves the process that issued it. The
`consumed_transaction_tokens` ledger enforces single use: `consumeTransactionToken` records the
`jti` and rejects a token whose `jti` is already recorded. `checkStepUp` matches the token's
`sessionID` before consuming it, so a token minted under one session cannot redeem under another.

## TOTP verification

`service-verification` issues and checks TOTP codes with `@epic-web/totp`, one verification row per
target and type (`2fa`, `2fa-setup`, `change-email`, `onboarding`):

- `createVerification` generates a code and returns the OTP.
- `verifyCode` checks it, consuming `change-email` and `onboarding` codes on success and deleting
  the row; `2fa` and `2fa-setup` codes stay, marked verified, each guarded so a replay matches zero
  rows.
- `get2FAVerificationURI` returns the authenticator-app URI for a pending 2FA setup.

## Credentials and password reset

`service-user` owns the credential path: `verifyPassword` gates login, while `changePassword` and
`resetPassword` rewrite the hash and sign the user out of every session. `service-user` stores a
reset token as its sha256 hash, and the token reaches the user only through the URL in the reset
email. `resetPassword` matches it in constant time.

## Service-to-service tokens

Every service call over the private network carries a short-lived JWT from `createServiceToken`
(`@vers/service-auth`): EdDSA over an Ed25519 keypair, 60-second default expiry. The `iss` claim and
the protected header's `kid` both name the minting service. The `sub` claim names the acting user,
omitted for a verified-anonymous call. The `aud` claim is the target service's registered audience,
`service-<name>` from `buildServiceAudience`.

Three issuers mint these tokens. Each signs with its own private key, the `SERVICE_AUTH_PRIVATE_KEY`
in its own environment, held by no other app:

- `app-web` signs the edge's outbound calls in `createEdgeServiceToken`.
- `service-replay` signs the worker's calls toward the keys service and toward version-pinned replay
  providers (`services/replay/src/dispatch/`).
- `service-activity` signs the wake call a committed append sends toward `service-replay`.

The service runtime (`@vers/service-runtime`) verifies every inbound token before any handler runs,
against `SERVICE_AUTH_JWKS`, a JWKS registering every issuer's public key under its `kid`. A token's
claimed `iss` must be a known issuer and equal its `kid`, and the signature validates only against
that issuer's registered key. A leaked minting key therefore lets its holder impersonate that one
service and no other. The runtime rejects a bad token with a plain 401
([service contracts](./service-contracts.md)).
