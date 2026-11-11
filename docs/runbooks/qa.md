# Manual QA

Use this runbook to test a player flow on production at `https://versidle.com` by hand, or to look
into a bug that only shows there. You drive the flow with a QA account, a real Chrome and the repo
scripts behind `bun run qa:*`. The scripts seed and reset accounts, read verification email, drive
the browser and log its worker traffic, and suspend the fleet. From the console of a game page, you
read the state of the [writer worker](../architecture/game/glossary.md) and run a QA avatar faster
than real time through the [debug hook](#debug-hook).

Three scripts change production state. Each one prints its target first, and each refuses when its
guard fails:

- `qa:seed` and `qa:reset` refuse an account address outside `qa.versidle.com`, whatever flags you
  pass.
- `qa:seed` refuses an `--origin` that is not a loopback address, and `qa:reset` refuses a
  `DATABASE_URL` host that is not loopback. Pass `--yes` only when the repo owner asks you to act on
  a remote deployment: it lifts this guard. With `--yes`, `qa:seed` still refuses a remote
  `--origin` that does not use https, because it sends the QA token only over https.
- `qa:cold` refuses when a request other than a health check or a deploy probe reached the fleet in
  the last 10 minutes.

Use an address under `qa.versidle.com` for every QA account. The domain receives mail through
Resend, so mail to any address on it, such as `qa+signup-1@qa.versidle.com`, lands where the
[inbox script](#inbox) reads it. Drive the public host `https://versidle.com`, never the app's
`fly.dev` hostname.

QA accounts live in the production database. Keep 50 or fewer there at a time. The scripts do not
count them, so count them with the `execute_sql_prod` tool of the `postgres` MCP server before you
seed one:

```sql
select count(*) from users where email like '%@qa.versidle.com';
```

## Accounts

`bun run qa:seed` creates a QA account through a web app, and `bun run qa:reset` resets one in the
database, so a pass starts from a known state without walking sign-up or grinding levels. Run either
one against production only when the repo owner asks you to.

```bash
bun run qa:seed --origin http://localhost:3000 --user qa-007 --level 1
bun run qa:seed --origin https://versidle.com --user qa-007 --level 6 --runs 3 --two-factor --yes
bun run qa:reset --user qa-007
bun run qa:reset --user qa-007 --all --yes
```

`--user` takes the account name: the part of the address before `@qa.versidle.com`.

`qa:seed` calls the web app at `--origin`, and needs one credential: the QA token. Set
`QA_SEED_TOKEN` in your environment to the value that the web app holds in its own `QA_SEED_TOKEN`
secret. The repo owner keeps each deployment's token in the `vers` 1Password vault. For a local web
app, put a value of 32 or more characters in `apps/web/.env.development.local` and in your
environment. A web app with no `QA_SEED_TOKEN` answers 404, so QA seeding is off on every deployment
that holds no token. The command needs none of the keys service's secrets: the web app passes the
call to the activity service, which creates the account and gets the avatar's keys from the keys
service. [Auth](../architecture/services/auth.md#qa-seeding-route) covers how the web app checks the
token.

`qa:reset` writes to the database at `DATABASE_URL`.

`qa:seed` creates `qa-007@qa.versidle.com` with the password from `--password`, or a generated one,
and an active avatar whose XP is the minimum for `--level`. The command prints the credentials once,
with the username and avatar name it derives from the account name. The username replaces each
character other than a letter, digit or `_` with `_`. The avatar name maps each digit to a letter
(`0` to `a`, `1` to `b`, and on to `9` to `j`) and drops every other character that is not a letter.
For `qa-007`, the username is `qa_007` and the avatar name is `qaaah`. `qa:seed` refuses an address
that already has an account.

The avatar carries a QA flag. Only `qa:seed` writes that flag, and only a flagged avatar can run
above real time through the debug hook.

`qa:seed` takes a `--level` from 1 to 1000. Above level 1, pass `--runs` with at least 1. An avatar
above level 1 with no stored run could never start a run: the game client starts the first run from
XP 0, and the activity service refuses a start whose XP differs from the avatar's. With
`--runs <n>`, at most 20, the activity service simulates `n` runs at the map's starting node with
the real engine. It stores each run the same way the activity and replay services store a finished,
verified run. The avatar keeps the XP and the reward items those runs earned, and the command prints
each run's outcome.

`--two-factor` adds an authenticator to the account and prints its secret and `otpauth://` URI.

`qa:reset` deletes the account's activities, [seed chains](../architecture/game/seed-chain.md),
items, and the grants recorded for its avatars, and returns its avatars to level 1 with the QA flag
kept. `--all` deletes the account itself, with its sessions and verifications. The logic of both
commands lives in `libs/testing/qa-account/`.

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

The command polls Resend until an email arrives for `--to`, matched without regard to case. It takes
only an email that Resend received no earlier than 2 minutes before the command started. It reads
the matching emails newest first and stops at the first that carries the requested kind.

An email from an earlier run within those 2 minutes still matches, and the command can return it at
once, with a stale code or link. To get only the email of this run, use a new address for each run,
such as `qa+signup-2@qa.versidle.com`. If you reuse an address, wait 2 minutes after its last email
before you start the flow. `--timeout` caps the poll in seconds (default 120); on timeout the
command prints why it stopped and exits 1. `--json` prints
`{ id, kind, code, url, subject, receivedAt }` on one line for an agent to parse.

The script takes a link only when its origin is `https://versidle.com`. A stranger can send mail to
a QA address, and this rule keeps a link to another site out of the output. `--kind` picks the
template to read; `any` (the default) tries each kind in the order of the table and reports the
first that matches.

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
suite. The e2e sign-up journey runs against a stand-in for Resend, and it reads the emails that the
stand-in captures through the same rules.

## Browser

Two repo scripts drive a real Chrome over the Chrome DevTools Protocol (CDP): `bun run qa:cdp`
drives one page or worker target, and `bun run qa:capture` logs every shared worker's RPC traffic.
Both speak to the browser's DevTools endpoint directly, over HTTP for the target list and over a
WebSocket per target, and they use no browser library. The `chrome-devtools` MCP server reaches the
same browser with a richer tool set. Use these scripts for what the MCP server cannot do:

- open each run in a fresh browser context;
- drive shared worker and service worker targets;
- take a page or a worker offline;
- print the stack of a running script (`qa:cdp pause`);
- record a CPU profile;
- log worker traffic to your terminal, where the log stays after the MCP server disconnects.

### Endpoint

Chrome exposes a DevTools endpoint only when it launches with `--remote-debugging-port` and
`--remote-allow-origins=*`, and it honors `--remote-debugging-port` only in a fresh instance. Run
the debug browser from its own profile directory, separate from the daily one. On Windows:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir=C:\temp\chrome-vers-debug
```

On Linux, `bun run qa:chrome start` launches a headless Chromium with its own profile on port 9222.
[Cut the network](qa-network-cut.md) covers its `--netns` mode.

The scripts read the endpoint from `--endpoint <host:port>`, then from `QA_CDP_ENDPOINT`, and
default to `127.0.0.1:9222`. A value from the flag or the environment must be a hostname or IPv4
address and a port from 1 to 65535; the scripts reject any other value before a command runs. The
port bridge a NAT-mode WSL distribution needs to reach the Windows loopback is in
[Chrome DevTools MCP](../../.claude/skills/chrome-devtools-mcp/SKILL.md#add-the-proxy). Behind the
bridge, the endpoint is the WSL default gateway on port 9223, the port that the bridge forwards to
Chrome's 9222. A session under NAT sets `QA_CDP_ENDPOINT` once:

```bash
export QA_CDP_ENDPOINT="$(ip route show default | awk '{print $3; exit}'):9223"
bun run qa:cdp targets
```

Chrome reports every target's socket URL against its own loopback, so the scripts rewrite the host
of each socket URL to the endpoint before they connect. A target that already has a DevTools client
attached reports no socket URL at all. For such a target, the scripts connect on the
`/devtools/page/<target_id>` path, which Chrome serves for every target type, and Chrome keeps both
clients attached.

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
| `offline <target> on\|off`                | takes a page or a worker offline until `offline <target> off`, or brings it back online |
| `pause <target>`                          | interrupts running script, prints the stack, and resumes                                |
| `profile <target> [--seconds]`            | samples the CPU and prints the functions with the most self time                        |
| `procs`                                   | lists the browser processes with their CPU time                                         |
| `monitor [--every] [--url]`               | polls the heap of matching targets and the renderer and GPU CPU times until interrupted |

Start a sign-up or sign-in flow with `new` and no `--context`: the tab opens signed out, in a
browser context of its own. To continue a flow in the same session, pass the printed context id back
through `--context`. The context, with its cookies and storage, lasts until the browser exits.

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

`offline <target> on` works on a page, shared worker or service worker target. Chrome drops network
emulation when the DevTools session that set it detaches, so the command leaves a background process
that holds the session open. The target stays offline until `offline <target> off` or until the
target closes. `offline <target> off` ends the background process and brings the target back online.

A reload of a held shared worker keeps the cut. Chrome gives the new worker the old target id, so
`offline <target> off` still takes the id you passed to `on`. The new worker starts paused, as
[Capturing worker traffic](#capturing-worker-traffic) explains, and the background process resumes
it. When the resume fails, the worker stays paused and runs none of its code. To recover a paused
worker:

1. Run `offline <target> off`. Expect: the failure of the resume, then `offline off`.
2. Detach every other DevTools session from the worker, then reload the page. With no session
   attached, the new worker runs at once. Expect: the page works and is online.
3. To cut the worker again, run `offline <target> on`.

### Capturing worker traffic

`qa:capture` polls the target list every second, attaches to each shared worker it has not seen, and
logs that worker's requests whose URL contains `--path` (default `/api/rpc/`) together with the
worker's console output and exceptions. With `--worker-url <substring>`, the capture attaches only
to workers whose script URL contains the substring. Each line starts with a timestamp. For a
request, the capture logs its method, URL and body. For a response, it logs the status, then the
body once the browser has it. For a failed request, it logs the browser's error text. The capture
shortens a long body and marks the cut with `…`.

```bash
bun run qa:capture --worker-url versidle.com
```

A reload or a closed last tab ends a shared worker, and the next page starts a new one. When any
DevTools session is attached to the old worker, Chrome starts the new worker paused for the
debugger. That session can be `qa:capture`, the background process of `qa:cdp offline`, or the
`chrome-devtools` MCP server. A paused worker runs none of its code, so it sends no request and
never answers the [debug hook](#debug-hook).

`qa:capture` and `qa:cdp offline` resume each new worker, so the capture log and the debug hook keep
working across a reload. With any other session attached, the new worker stays paused. Detach that
session, then reload the page.

## Cut the network

`qa:cdp offline` takes one target offline. To cut every page and worker at once, run the browser
with `bun run qa:chrome start --netns`, in its own network namespace, then run `bun run qa:net cut`.
[Cut the network](qa-network-cut.md) holds the procedure.

## Debug hook

Read the writer worker's state and set a QA avatar's simulation speed from the page console through
`window.__versQA`, with no DevTools session on the worker. app-web installs the object on a game
page only when the session's email is under `qa.versidle.com`, or when the URL of a non-production
build's page carries `?qa=1`. The server reads the email from the session and hands the page only a
yes or no, so the page never sees the email. Every other page has no object and runs no extra code.
[QA debug hook](qa-debug-hook.md) covers `snapshot()` and `setSpeed()`.

## Cold path

`bun run qa:cold` suspends the fleet so you can test a cold start by hand.
[QA cold path](qa-cold-path.md) covers its traffic check, its flags and its credentials.
