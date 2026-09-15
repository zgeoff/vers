# Auth

Authentication and step-up authorization split across three domain services and the web edge. The
edge runs the credential and code flows, holds the session cookie, and signs the service-to-service
token for its own outbound calls. Durable state lives in the services: sessions and step-up
transactions in the session service, password credentials and reset tokens in the user service, TOTP
verifications in the verification service. Services never see cookies. The edge validates the
session and passes each service a short-lived token naming the acting user, so a service trusts the
token's claims and nothing else ([service contracts](./service-contracts.md)).

## Session lifecycle

A login validates the honeypot and the fields, then checks the email and password against the user
service. A wrong email or password reports one form-level error, never which was wrong. The session
service then writes an unverified session row, with a longer lifetime when the player asks to be
remembered. With 2FA on the account, the edge redirects to the code prompt carrying the pending
session id; without it, sign-in completes directly. Onboarding creates the user, then the session,
then completes the same sign-in. An onboarding retry that finds the email already taken checks the
submitted password: a match signs the player in through the same path, and a mismatch reports that
the account exists.

Sign-in redirects to a force-logout prompt when the account already holds a live session; otherwise
it verifies the session and seals the cookie. Verifying a session mints the first access and refresh
token pair, marks the row verified, and evicts every other session of the same user in one
statement, so at most one verified session per user survives. Each token is a JWT subject-bound to
the user and signed with the session service's private key. Access tokens are short-lived and rotate
through a refresh call, which rejects a reused refresh token.

The session cookie is httpOnly, same-site, secure in production, and sealed by an app secret.
Reading it never throws, and an absent token is how the edge observes "signed out". A partial
session, one missing any of the session id, access token, or refresh token, reads the same way, and
the edge runs the logout path before it redirects to login, so whatever partial cookie state
remained is cleared. A service's `UNAUTHORIZED` on a page load's server call takes the same logout
path and redirect.

## Step-up authorization

A sensitive mutation (an email change, a password change, or disabling 2FA) demands a fresh code
check before it runs. The step-up check decides in priority order: with no live 2FA verification for
the target, the mutation proceeds; with a valid, unused transaction token on the resubmission, the
mutation proceeds; otherwise the edge creates a pending transaction and challenges the caller for a
code.

One handler verifies the challenge for every gated mutation. An invalid code counts a failed attempt
against the pending transaction, and the edge abandons the transaction after a fixed number of
failures. A valid code atomically consumes the pending transaction and mints a transaction token.

A pending transaction lives in postgres with its action, target, IP, and owning session. Postgres
cascade-deletes it with the session, it expires on its own, and consuming it rejects a request whose
action, IP, session, or target does not match the stored row.

The transaction token is a short-lived JWT minted and verified only inside the edge process, against
a per-process in-memory keypair, because it round-trips through the browser between the code check
and the mutation. It is proof a code check passed, redeemable once by the mutation it names. A
ledger records each consumed token id and rejects a repeat, and the check matches the token's
session before consuming it, so a token minted under one session cannot redeem under another.

## TOTP verification

The verification service issues and checks TOTP codes, one verification row per target and type
(`2fa`, `2fa-setup`, `change-email`, `onboarding`). An emailed code lives for minutes; an
authenticator code lives one TOTP period. Verifying consumes an emailed code on success and deletes
its row. An authenticator code's row stays, marked verified and guarded so a replay matches zero
rows. The service also returns the authenticator-app URI for a pending 2FA setup.

## Credentials and password reset

The user service owns the credential path: it verifies a password at login, and a password change or
reset rewrites the hash and signs the user out of every session. It stores a reset token as its
hash, the token reaches the user only through the URL in the reset email, and the reset matches it
in constant time.

## Service-to-service tokens

Every service call over the private network carries a short-lived JWT signed with an Ed25519
keypair. The issuer claim and the key id both name the minting service, the subject names the acting
user and is omitted for a verified-anonymous call, and the audience is the target service's
registered audience. Three issuers mint these tokens, each with its own private key held by no other
app: the web edge for its outbound calls, the replay service for its calls toward the keys service
and the version-pinned replay providers, and the activity service for the wake call a committed
append sends toward the replay service.

The service runtime verifies every inbound token before any handler runs, against a key set
registering every issuer's public key under its key id. A token's claimed issuer must be a known
issuer and equal its key id, and the signature validates only against that issuer's registered key,
so a leaked minting key lets its holder impersonate that one service and no other. The runtime
rejects a bad token with a plain 401 ([service contracts](./service-contracts.md)).
