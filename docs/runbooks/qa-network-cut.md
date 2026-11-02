# Cut the network

A device in airplane mode loses the network in every browser context at once, while DevTools network
emulation takes one target offline at a time. `bun run qa:chrome start --netns` runs a headless
Chromium in its own rootless network namespace through `pasta`, and `bun run qa:net` takes the
namespace's network interface down and brings it back. The page, the shared worker, and any service
worker lose the network together, and `navigator.onLine` turns false in each. The DevTools port
stays reachable during a cut, so [`qa:cdp`](qa.md#driving-a-target),
[`qa:capture`](qa.md#capturing-worker-traffic), and the [debug hook](qa.md#debug-hook) keep working.

The machine needs Linux with `chromium`, `pasta` from the `passt` package, and `nsenter`, `unshare`,
and `ip`, which util-linux and iproute2 ship. No step needs root.

## Cut and restore

1. Start the browser with a short `TMPDIR`:

   ```bash
   TMPDIR=$XDG_RUNTIME_DIR bun run qa:chrome start --netns
   ```

   Expect: `✓ Chromium runs in its own network namespace`, and the DevTools endpoint
   `127.0.0.1:9222`.

2. Open the game, and drive it with `qa:cdp`:

   ```bash
   bun run qa:cdp new https://versidle.com/
   ```

3. Cut the network:

   ```bash
   bun run qa:net cut
   ```

   Expect: `✓ cut: eth0 is down`, with the count of the routes saved.

4. Bring the network back:

   ```bash
   bun run qa:net restore
   ```

   Expect: `✓ restored: eth0 is up`.

5. Stop the browser:

   ```bash
   bun run qa:chrome stop
   ```

| Command                                     | Effect                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `qa:chrome start [--netns] [--port <port>]` | launches the browser, in a network namespace with `--netns`, with DevTools on the port (9222) |
| `qa:chrome stop`                            | stops every process of the browser                                                            |
| `qa:net cut`                                | saves the namespace's IPv4 and IPv6 routes, then takes the default route's interface down     |
| `qa:net restore`                            | brings the interface up and replays every saved route                                         |
| `qa:net status`                             | prints the browser, its namespace, and whether the network is up or cut                       |

## How the namespace works

`pasta` copies the host's interface name and routes into the namespace, and it forwards the host's
`127.0.0.1:<port>` to the namespace's loopback, which a cut leaves up. Taking a link down deletes
its routes, so `restore` replays the routes that `cut` saved; bringing the link up alone leaves the
browser with no default route. Without `--netns`, `start` runs the same browser on the host network,
which `qa:net` refuses to cut.

The browser keeps its profile, its log, and the state the commands share under
`$XDG_STATE_HOME/vers/qa-chrome/`, or `~/.local/state/vers/qa-chrome/` when the variable is unset.
The profile lasts across starts, so a signed-in QA account stays signed in.

## Refusals

Each command exits 1 with the reason when it refuses:

- `start --netns` refuses when `pasta` or `chromium` is not on `PATH`.
- `start` refuses a `TMPDIR` longer than 62 bytes. Chromium makes its singleton socket under
  `TMPDIR`, and a longer one fails with `Socket path too long`. `$XDG_RUNTIME_DIR` is short enough.
- `start` refuses while a browser it launched still runs, or while a DevTools endpoint already
  answers on the port.
- `stop` and every `qa:net` command refuse when no browser runs, and `qa:net` refuses a browser that
  runs without a namespace.
