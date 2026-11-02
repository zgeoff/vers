# Cut the network

Use this runbook to test how the game behaves when a player's device loses the network, as in
airplane mode. The game runs code in three places: the page, a shared worker that the page starts,
and any service worker the origin registers. Airplane mode cuts all three at once. The DevTools
Offline switch and the `offline` command of [`qa:cdp`](qa.md#driving-a-target) each cut one page or
worker, so a page can go offline while its shared worker keeps the network.

`pasta` is a tool that gives a process its own network namespace without root.
`bun run qa:chrome start --netns` uses it to run a headless Chromium in a namespace of its own.
`bun run qa:net cut` takes the namespace's network interface down, so the page, the shared worker
and any service worker lose the network together, and `navigator.onLine` turns false in each.
`bun run qa:net restore` brings the interface back. The DevTools endpoint answers through a cut, so
you drive and inspect the browser with [`qa:cdp`](qa.md#driving-a-target),
[`qa:capture`](qa.md#capturing-worker-traffic) and the [debug hook](qa.md#debug-hook).

## Before you start

Install these on a Linux machine:

- `chromium`;
- `pasta`, from the `passt` package;
- `nsenter` and `unshare`, from util-linux;
- `ip`, from iproute2.

Every step runs as your own user.

Chromium fails with `Socket path too long` when `TMPDIR` is longer than 62 bytes, and
`qa:chrome start` refuses such a `TMPDIR`. Set `TMPDIR=$XDG_RUNTIME_DIR` on the start command, as
step 1 does.

## Cut and restore

1. Start the browser:

   ```bash
   TMPDIR=$XDG_RUNTIME_DIR bun run qa:chrome start --netns
   ```

   Expect: `✓ Chromium runs in its own network namespace`, and `DevTools: 127.0.0.1:9222`.

2. Open the game in a new tab:

   ```bash
   bun run qa:cdp new https://versidle.com/
   ```

   Expect: a line of JSON. Keep its `targetId` for the next steps.

3. Bring the game to the screen under test with `qa:cdp`. A screen behind sign-in needs a
   [QA account](qa.md#accounts). The tab from step 2 is in a fresh browser context, which loses its
   cookies when the browser stops, so sign in again after each start.

4. Cut the network:

   ```bash
   bun run qa:net cut
   ```

   Expect: `✓ cut: <interface> is down`. `<interface>` is the name of the host's network interface,
   such as `eth0`.

5. Inspect the game while it is offline. `<target_id>` is the `targetId` from step 2.

   ```bash
   bun run qa:cdp eval <target_id> "navigator.onLine"
   bun run qa:cdp shot <target_id> ./offline.png
   bun run qa:cdp eval <target_id> "window.__versQA.snapshot()"
   ```

   Expect: `false` from the first command. The second writes a screenshot of the page. The third
   prints the shared worker's state, on a page signed in with a QA account.

6. Bring the network back:

   ```bash
   bun run qa:net restore
   ```

   Expect: `✓ restored: <interface> is up`.

7. Stop the browser:

   ```bash
   bun run qa:chrome stop
   ```

   Expect: `✓ stopped the browser`.

## Commands

| Command                                     | Effect                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `qa:chrome start [--netns] [--port <port>]` | launches the browser; `--netns` puts it in its own namespace; `--port` sets DevTools' port, 9222 by default |
| `qa:chrome stop`                            | stops every process of the browser, and its namespace                                                       |
| `qa:net cut`                                | saves the namespace's routes, then takes the default route's interface down and keeps its IPv6 addresses    |
| `qa:net restore`                            | brings the interface up and replays every saved route                                                       |
| `qa:net status`                             | prints the browser, its namespace, and whether the network is up or cut                                     |

`qa:net` and `qa:chrome stop` take no `--port`, because they act on the one browser that `start`
launched. A `start` without `--netns` runs the same browser on the host network, for a pass that
never cuts the network.

## How the namespace works

`pasta` copies the host's interface name and routes into the namespace. It forwards the host's
`127.0.0.1:<port>` to the namespace's loopback interface, which a cut leaves up, so the DevTools
endpoint answers through a cut. Taking an interface down deletes its routes, so `cut` saves them
first and `restore` replays them. Bringing the interface up without the routes leaves the browser
with no default route.

The namespace lives as long as the browser. `qa:chrome stop` during a cut removes both, and the next
`start` gets a fresh namespace with the network up.

The commands keep their files under `$XDG_STATE_HOME/vers/qa-chrome/`, or
`~/.local/state/vers/qa-chrome/` when the variable is unset:

- `profile/` is the Chromium profile, kept across starts.
- `chrome.log` holds the output of the latest start.
- `state.json` holds the browser's process ID, its port, its namespace, and the routes a cut saved.
  A `start` overwrites a file whose browser no longer runs.

## Refusals

Each command exits 1 with the reason when it refuses:

| Refusal                                                  | What to do                                              |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `start --netns` finds no `pasta` on `PATH`               | install the `passt` package                             |
| `start` finds no `chromium` on `PATH`                    | install Chromium                                        |
| `start` gets a `TMPDIR` longer than 62 bytes             | rerun with `TMPDIR=$XDG_RUNTIME_DIR`                    |
| `start` finds a browser that an earlier `start` launched | run `bun run qa:chrome stop` first                      |
| `start` finds a DevTools endpoint answering on the port  | pass another `--port`, or stop the browser on that port |
| `stop` finds no browser running                          | nothing: no browser is left to stop                     |
| `qa:net` finds no browser running                        | run `bun run qa:chrome start --netns`                   |
| `qa:net` finds a browser started without `--netns`       | stop it, and start it again with `--netns`              |
