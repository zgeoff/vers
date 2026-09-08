# Manual QA

Manual QA drives production at `https://versidle.com` with a QA account, a real Chrome, and the repo
scripts behind `bun run qa:*`. The scripts seed and reset accounts, read verification email, drive
the browser and log its worker traffic, and send the fleet cold. A read-only hook on the game page
shows the writer worker's state from the console. `qa:seed`, `qa:reset`, and `qa:cold` change
production state, so each one prints its target and refuses when its guard fails: an address outside
`qa.versidle.com`, a database host that is not loopback without `--yes`, or a fleet that served a
request in the last 10 minutes.

A QA account is an address under `qa.versidle.com`, a Resend receiving domain: mail to any address
on it (`qa+signup-1@qa.versidle.com`) lands in Resend's received mail, where the inbox script reads
it. The production database is pre-release, so QA accounts live on it, at most 50 at a time. QA
drives the public host `https://versidle.com`, never the app's `fly.dev` hostname; the inbox accepts
a link only when its origin is `https://versidle.com`.

## Accounts

`bun run qa:seed` and `bun run qa:reset` write a QA account straight into the database that
`DATABASE_URL` names, so a pass starts from a known state without walking sign-up or grinding
levels. Both commands accept only an address under `qa.versidle.com`, print the target host before
they act, and refuse a host that is not a loopback address unless you pass `--yes`. Production use
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
equal what the services derive for the avatar. `qa:seed` refuses an address that already has an
account.

`qa:reset` deletes the account's activities, chains, items, and grants and returns its avatars to
level 1; `--all` deletes the account itself, with its sessions and verifications. The logic lives in
`libs/testing/qa-account/`.

## Inbox

The sign-up, change-email, reset-password, and two-factor flows each send an email that carries a
code or a link, and `bun run qa:inbox` reads that code or link back from Resend, so an agent driving
a flow finishes it without a mailbox. The script polls the Resend Receiving API from the machine
that runs it; there is no webhook and no server.

### Credential

The script reads `RESEND_API_KEY` from the environment. When the variable is unset, it reads the
`resend` item in the `vers` 1Password vault through the `op` CLI: the `full-access-api-key` field,
or `api-key` when that field is absent. The `op` call runs on the same service-account token as
`bun run env:pull`, with no sign-in. A restricted sending key cannot read received mail: Resend
answers `restricted_api_key`, and the script exits with that message. The key never appears in the
script's output.

### Commands

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

## Browser

Two repo scripts drive a real Chrome over the Chrome DevTools Protocol (CDP): `bun run qa:cdp`
drives one page or worker target, and `bun run qa:capture` logs every shared worker's RPC traffic.
Both speak to the browser's DevTools endpoint directly, over HTTP for the target list and over a
WebSocket per target; no browser library sits in between. The `chrome-devtools` MCP server reaches
the same browser with a richer tool set; these scripts cover what it cannot: a fresh browser context
per run, worker targets, offline emulation, a stack pause, a CPU profile, and a traffic log that
survives the session.

### Endpoint

Chrome exposes a DevTools endpoint only when it launches with `--remote-debugging-port` and
`--remote-allow-origins=*`, and it honors `--remote-debugging-port` only in a fresh instance, so the
debug browser runs from its own profile directory, separate from the daily one:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir=C:\temp\chrome-vers-debug
```

The scripts read the endpoint from `--endpoint <host:port>`, then from `QA_CDP_ENDPOINT`, and
default to `127.0.0.1:9222`. A value from the flag or the environment must be a hostname or IPv4
address and a port from 1 to 65535; the scripts reject any other value before a command runs. The
port bridge a NAT-mode WSL distribution needs to reach the Windows loopback is in
[Chrome DevTools MCP](./chrome-devtools-mcp.md#bridge-the-debug-port-one-time). Behind the bridge
the endpoint is the WSL default gateway on the bridged port, so a session under NAT sets
`QA_CDP_ENDPOINT` once:

```bash
export QA_CDP_ENDPOINT="$(ip route show default | awk '{print $3; exit}'):9223"
bun run qa:cdp targets
```

Chrome reports every target's socket URL against its own loopback, so the scripts rewrite the host
of each socket URL to the endpoint before they connect. A target that already has a DevTools client
attached reports no socket URL at all; the scripts then connect on the `/devtools/page/<target_id>`
path Chrome serves for every target type.

### Driving a target

`qa:cdp` takes a global `--endpoint` before the command name, then one command:

```bash
bun run qa:cdp new https://versidle.com/
bun run qa:cdp eval <target_id> "__qa.clickText('Sign in')"
bun run qa:cdp shot <target_id> ./after-sign-in.png
```

| Command                                   | Effect                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `targets`                                 | lists every target as type, id, url, and title                                          |
| `new [url] [--context <id>]`              | opens a tab in a fresh browser context, or in the context given, and prints both ids    |
| `ctx <target>`                            | prints the target's browser context id                                                  |
| `close <target>`                          | closes the target                                                                       |
| `nav <target> <url>`                      | navigates and waits for the load event, then prints the landed url                      |
| `reload <target>`                         | reloads and waits for the load event                                                    |
| `eval <target> <script>`                  | evaluates the script, awaits a promise, and prints the value as JSON                    |
| `text <target>`                           | prints the page's visible text                                                          |
| `shot <target> <file>`                    | writes a PNG screenshot                                                                 |
| `type <target> <selector> <text>`         | focuses the element and types one keystroke at a time                                   |
| `insert <target> <selector> <text>`       | focuses the element and inserts the text as one input event                             |
| `key <target> <key>`                      | presses one key, such as `Enter`, `Tab`, or `Escape`                                    |
| `click <target> <x> <y>`                  | clicks at viewport coordinates                                                          |
| `console <target> [--seconds] [--reload]` | collects console calls, exceptions, and browser log entries for the window              |
| `offline <target> on\|off`                | switches network emulation of a page or a worker                                        |
| `pause <target>`                          | interrupts running script, prints the stack, and resumes                                |
| `profile <target> [--seconds]`            | samples the CPU and prints the functions with the most self time                        |
| `procs`                                   | lists the browser processes with their CPU time                                         |
| `monitor [--every] [--url]`               | polls the heap of matching targets and the renderer and GPU CPU times until interrupted |

A browser context created over CDP is ephemeral: it lives until the browser exits, and its cookies
and storage go with it. Each `new` without `--context` starts from a signed-out state, which is what
a sign-up or sign-in flow wants; a flow that continues in the same session passes the printed
context id back through `--context`.

`eval` installs a `window.__qa` object on a page before it evaluates the script, so a flow drives
React-controlled inputs without pasting helpers in:

- `__qa.setValue(selector, value)` sets an input's or textarea's value through the native setter and
  dispatches `input` and `change`, so React sees the change.
- `__qa.clickText(text, selector?)` clicks the first button, link, label, or `role=button` element
  whose trimmed text equals `text`, and returns `none:<text>` when nothing matches.
- `__qa.submit()` calls `requestSubmit()` on the first form.
- `__qa.wait(ms)` resolves to the page text after the delay.

`pause` prints the stack only when script is running: an idle page fires no pause event, and the
command reports the timeout instead.

### Capturing worker traffic

`qa:capture` polls the target list every second, attaches to each shared worker it has not seen, and
logs that worker's requests whose URL contains `--path` (default `/api/rpc/`) together with the
worker's console output and exceptions. `--worker-url <substring>` keeps the attachment to workers
whose script URL contains it. Each line carries a timestamp; a request prints its method, URL, and
body, a response prints its status and then its body once the browser has it, and a failed request
prints the browser's error text. The log cuts a body longer than 1500 characters and marks the cut
with `…`.

```bash
bun run qa:capture --worker-url versidle.com
```

The attachment keeps a shared worker alive: a shared worker with no page left holds on as long as a
DevTools client is attached, so a worker whose last tab closed during a capture lingers as a zombie
until the capture stops. Stop the capture (Ctrl-C) before closing the last tab of a context.

## Debug hook

A QA tester reads the writer worker's state from the page console through `window.__versQA`, with no
DevTools attachment to the worker. app-web installs the object on a game page only when the
session's email is under `qa.versidle.com`, or when a non-production build carries `?qa=1`. The
server decides the account gate from the session and hands the page a boolean, so the page never
reads the email, and every other page carries no object and runs no extra code.

```js
await window.__versQA.snapshot();
```

`snapshot()` answers one read-only worker message with a copy of the live run, the durable outbox
with each pending start's attempts and last refusal, the latest-run record the next mint folds from,
the writer's identity, and the last 200 worker events kept in a ring buffer inside the worker:
lifecycle phases, start and flush outcomes, refusals, and connectivity changes. The hook reads and
never writes: it changes no runtime state and no durable store.
[Game simulation](../game/game-simulation.md#writer-election) owns the writer worker, and
[offline reconcile](../game/offline-reconcile.md#worker-lifecycle) owns the lifecycle the events
trace.

## Cold path

`bun run qa:cold` sends the fleet cold for manual QA of a cold start: it suspends every service
machine of every app in `deploy.config.ts`, stopping instead where the app's `fly.toml` parks idle
machines with `stop`, then prints each app's machine states. Before it touches a machine it reads
the `vers-traces` dataset in Axiom for the last 10 minutes and refuses, with the request count and
the busiest routes, when any request other than a `/health` check or the anonymous `getCurrentUser`
probe reached the fleet, so a fleet that is serving a player is never sent cold. The script refuses
`--force`: the manifest names only production apps, and no other fleet exists to accept it.

```bash
bun run qa:cold --dry-run
bun run qa:cold --wait
```

`--dry-run` prints the verdict and the planned actions without acting. `--wait` polls until every
machine reports suspended or stopped, for at most 3 minutes; the deadline also ends a `flyctl` read
that is still pending, so a stalled read cannot hold the wait open past it. The script reads
`AXIOM_TOKEN` and `FLY_API_TOKEN` from the environment, and when either is unset it reads the
`vers-ci` 1Password vault through the `op` CLI: the `axiom` item's `iac-token` field and the
`github-actions` item's `fly-api-token` field.
