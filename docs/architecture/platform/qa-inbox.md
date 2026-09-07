# QA inbox

Manual QA against production drives the sign-up, change-email, reset-password, and two-factor flows,
and each flow sends an email that carries a code or a link. `bun run qa:inbox` reads that code or
link back from Resend, so an agent driving a flow finishes it without a mailbox. Test addresses live
on `qa.versidle.com`, a Resend receiving domain: mail to any address on it
(`qa+signup-1@qa.versidle.com`) lands in Resend's received mail, and the script reads it over the
Resend Receiving API. The script polls that API from the machine that runs it; there is no webhook
and no server.

## Credential

The script reads `RESEND_API_KEY` from the environment. When the variable is unset, it reads the
`resend` item in the `vers` 1Password vault through the `op` CLI: the `full-access-api-key` field,
or `api-key` when that field is absent. The `op` call runs on the same service-account token as
`bun run env:pull`, with no sign-in. A restricted sending key cannot read received mail: Resend
answers `restricted_api_key`, and the script exits with that message. The key never appears in the
script's output.

## Commands

`wait` polls for an email to one address and prints what the flow needs from it:

```bash
bun run qa:inbox wait --to qa+signup-1@qa.versidle.com --kind welcome
bun run qa:inbox wait --to qa+signup-1@qa.versidle.com --kind any --timeout 60 --json
```

The poll lists the newest 100 received emails every 3s, keeps those sent to `--to`
(case-insensitive) and created within the 2 minutes before the command started, and reads each
candidate's body newest first until one carries the requested kind. `--timeout` caps the poll in
seconds (default 120); on timeout the command prints why it stopped and exits 1. `--json` prints
`{ id, kind, code, url, subject, receivedAt }` on one line for an agent to parse.

A link counts only when its origin is `https://versidle.com`, so mail from a third party to a QA
address cannot pass off another site's link as the production one. `--kind` names the template to
read; `any` (the default) tries each kind in the order of the table and reports the first that
matches.

| Kind             | Email                    | `code`                       | `url`                      |
| ---------------- | ------------------------ | ---------------------------- | -------------------------- |
| `welcome`        | sign-up verification     | the 6-character sign-up code | the `/verify-otp` link     |
| `change-email`   | new-address verification | the 6-character code         | the `/verify-otp` link     |
| `reset-password` | password reset           | none                         | the `/reset-password` link |
| `two-factor`     | two-factor sign-in       | the 6-digit code             | none                       |

`list` prints the newest received emails as a table of id, recipients, received time, and subject,
newest first; `--to` keeps one address and `--limit` caps the rows (default 20, at most 100):

```bash
bun run qa:inbox list --to qa+signup-1@qa.versidle.com --limit 5
```

`show` prints one email's subject, sender, recipients, received time, and plain-text body; `--json`
prints the whole record, html included:

```bash
bun run qa:inbox show <received_email_id>
```

The extraction rules live in `scripts/src/qa-inbox/`, and their tests render the templates in
`@vers/email` with known codes and links, so a template change that moves a code or a link fails the
suite. The e2e sign-up journey reads the stub's captured sends through the same rules.

## QA accounts

`bun run qa:seed` and `bun run qa:reset` write a QA account straight into the database that
`DATABASE_URL` names, so a pass starts from a known state without walking sign-up or grinding
levels. Both commands accept only an address under `qa.versidle.com`, print the target host before
they act, and refuse a host that is not a loopback address unless `--yes` is passed. Production use
is the owner's explicit choice: point `DATABASE_URL` at the pre-release database and pass `--yes`.

```bash
bun run qa:seed --user qa-007 --level 6
bun run qa:seed --user qa-007 --level 6 --runs 3 --two-factor --yes
bun run qa:reset --user qa-007
bun run qa:reset --user qa-007 --all --yes
```

`qa:seed` creates `qa-007@qa.versidle.com` with the password from `--password`, or a generated one,
and an active avatar whose XP is the minimum for `--level`. The username and avatar name derive from
the account name under their contracts (`qa_007` and `qaaah` for `qa-007`), and the command prints
them with the credentials once; `--two-factor` writes an authenticator verification and prints its
secret and `otpauth://` URI. With `--runs`, it seeds that many origin-node runs, each simulated with
the real engine to its terminal checkpoint against the registry's current content document and
stamped with the current sim version, then stored as the activity and replay services would leave
them: hashed checkpoints, `verified_head` at the appended head, settled XP on the avatar, minted
reward items, both chain anchors on the last run's tail, and a first-clear grant once a run
completes. The command prints each run's outcome. Deriving those runs needs the keys service's
`SCOPE_SECRET_ROOTS` and `ROLL_KEY_ROOTS` in the environment, so the seeded encounter and items
equal what the services derive for the avatar. An address that already has an account is refused.

`qa:reset` deletes the account's activities, chains, items, and grants and returns its avatars to
level 1; `--all` deletes the account itself, with its sessions and verifications. The logic lives in
`libs/testing/qa-account/`, its own package: the sealed encounter derivation it calls is
`server-only`, and the root manifest and the e2e app both depend on `@vers/scripts`, so the tool
cannot live there.
