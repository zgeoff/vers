# Chrome DevTools MCP across the WSL boundary

The `chrome-devtools` MCP server, registered in [`.mcp.json`](../../../.mcp.json), gives an agent
DevTools-protocol access to a real Chrome on the Windows host: script evaluation, screenshots,
synthetic input, and console and network capture, against the GPU and browser build the app ships
to. Chrome binds its debugging port to the Windows loopback only, and a NAT-mode WSL distribution
cannot reach that loopback, so a port proxy on the Windows side bridges the gap. The server resolves
the Windows host through the WSL default gateway at launch, so a reboot-reassigned gateway needs no
reconfiguration.

Under mirrored networking (`wslinfo --networking-mode` prints `mirrored`), WSL shares the Windows
loopback: skip the bridge and point the server's `--browser-url` at `http://127.0.0.1:9222`.

The debugging protocol fully drives the browser it reaches — script evaluation, input, screenshots —
and `--remote-allow-origins=*` waives the DevTools origin check, so the bridge grants that control
to anything that can reach port 9223 from the firewall rule's private range. The debug browser runs
a dedicated empty profile and never the daily one, and the bridge is torn down when a debugging
session ends.

## Bridge the debug port (one-time)

1. Forward a WSL-reachable port to Chrome's loopback-bound one — PowerShell as administrator:

   ```powershell
   netsh interface portproxy add v4tov4 listenport=9223 listenaddress=0.0.0.0 connectport=9222 connectaddress=127.0.0.1
   ```

2. Allow inbound 9223 from WSL — PowerShell as administrator:

   ```powershell
   New-NetFirewallRule -DisplayName 'WSL chrome-debug 9223' -Direction Inbound -LocalPort 9223 -Protocol TCP -Action Allow -RemoteAddress 172.16.0.0/12
   ```

   The remote-address scope covers the whole private range WSL draws its NAT subnets from — a rule
   scoped to one boot's subnet stops matching after a reboot reassigns it.

## Launch the debug browser

Chrome honors `--remote-debugging-port` only when it starts a fresh instance, so a dedicated profile
directory keeps the daily browser out of the way:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir=C:\temp\chrome-vers-debug
```

The same binary launches from WSL at `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe`.

Verify the bridge end to end from WSL:

```bash
curl -s "http://$(ip route show default | awk '{print $3; exit}'):9223/json/version"
```

Expect: a JSON body opening with `"Browser": "Chrome/…"`. An empty response while
`netsh interface portproxy show v4tov4` lists the forward means the firewall rule is missing or
scoped short of the current WSL subnet.

## Connect

A Claude Code session started while the bridge is up connects on its own; in a running session,
`/mcp` reconnects the server. The working-state check is `list_pages` answering with the debug
browser's open tabs.

## Teardown

PowerShell as administrator:

```powershell
netsh interface portproxy delete v4tov4 listenport=9223 listenaddress=0.0.0.0
Remove-NetFirewallRule -DisplayName 'WSL chrome-debug 9223'
```

The debug profile at `C:\temp\chrome-vers-debug` is disposable.
