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
