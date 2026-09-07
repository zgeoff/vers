# QA browser tools

Manual QA against production drives a real Chrome over the Chrome DevTools Protocol (CDP). Two repo
scripts wrap that protocol: `bun run qa:cdp` drives one page or worker target, and
`bun run qa:capture` logs every shared worker's RPC traffic. Both speak to the browser's DevTools
endpoint directly, over HTTP for the target list and over a WebSocket per target; no browser library
sits in between. The `chrome-devtools` MCP server reaches the same browser with a richer tool set;
these scripts cover what it cannot: a fresh browser context per run, worker targets, offline
emulation, a stack pause, a CPU profile, and a traffic log that survives the session.

## Endpoint

The scripts read the endpoint from `--endpoint <host:port>`, then from `QA_CDP_ENDPOINT`, and
default to `127.0.0.1:9222`. Chrome exposes that endpoint only when it launches with
`--remote-debugging-port` and `--remote-allow-origins=*`; the launch line, and the port bridge a
NAT-mode WSL distribution needs to reach it, are in
[Chrome DevTools MCP](./chrome-devtools-mcp.md#launch-the-debug-browser). Behind the bridge the
endpoint is the WSL default gateway on the bridged port (`172.28.80.1:9223` on one machine), so a
session under NAT sets `QA_CDP_ENDPOINT` once:

```bash
export QA_CDP_ENDPOINT="$(ip route show default | awk '{print $3; exit}'):9223"
bun run qa:cdp targets
```

Chrome reports every target's socket URL against its own loopback, so the scripts rewrite the host
of each socket URL to the endpoint before they connect. A target that already has a DevTools client
attached reports no socket URL at all; the scripts then connect on the `/devtools/page/<target_id>`
path Chrome serves for every target type.

## Driving a target

`qa:cdp` takes a global `--endpoint` before the command name, then one command:

```bash
bun run qa:cdp new https://versidle.com/
bun run qa:cdp eval <target_id> "__qa.clickText('Sign in')"
bun run qa:cdp shot <target_id> ./after-sign-in.png
```

| Command                                   | Effect                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `targets`                                 | lists every target as type, id, url, and title                                       |
| `new [url] [--context <id>]`              | opens a tab in a fresh browser context, or in the context given, and prints both ids |
| `ctx <target>`                            | prints the target's browser context id                                               |
| `close <target>`                          | closes the target                                                                    |
| `nav <target> <url>`                      | navigates and waits for the load event, then prints the landed url                   |
| `reload <target>`                         | reloads and waits for the load event                                                 |
| `eval <target> <script>`                  | evaluates the script, awaits a promise, and prints the value as JSON                 |
| `text <target>`                           | prints the page's visible text                                                       |
| `shot <target> <file>`                    | writes a PNG screenshot                                                              |
| `type <target> <selector> <text>`         | focuses the element and types one keystroke at a time                                |
| `insert <target> <selector> <text>`       | focuses the element and inserts the text as one input event                          |
| `key <target> <key>`                      | presses one key, such as `Enter`, `Tab`, or `Escape`                                 |
| `click <target> <x> <y>`                  | clicks at viewport coordinates                                                       |
| `console <target> [--seconds] [--reload]` | collects console calls, exceptions, and browser log entries for the window           |
| `offline <target> on\|off`                | switches network emulation of a page or a worker                                     |
| `pause <target>`                          | interrupts running script, prints the stack, and resumes                             |
| `profile <target> [--seconds]`            | samples the CPU and prints the functions with the most self time                     |
| `procs`                                   | lists the browser processes with their CPU time                                      |
| `monitor [--every] [--url]`               | polls the heap of matching targets and the renderer CPU time until interrupted       |

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

## Capturing worker traffic

`qa:capture` polls the target list every second, attaches to each shared worker it has not seen, and
logs that worker's requests whose URL contains `--path` (default `/api/rpc/`) together with the
worker's console output and exceptions. `--worker-url <substring>` keeps the attachment to workers
whose script URL contains it. Each line carries a timestamp; a request prints its method, URL, and
body, a response prints its status and then its body once the browser has it, and a failed request
prints the browser's error text. A body longer than 1500 characters is cut and marked with `…`.

```bash
bun run qa:capture --worker-url versidle.com
```

The attachment keeps a shared worker alive: a shared worker with no page left holds on as long as a
DevTools client is attached, so a worker whose last tab closed during a capture lingers as a zombie
until the capture stops. Stop the capture (Ctrl-C) before closing the last tab of a context.
