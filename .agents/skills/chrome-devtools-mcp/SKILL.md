---
name: chrome-devtools-mcp
description:
  Connects the chrome-devtools MCP server in WSL to Chrome on the Windows host, covering the port
  proxy, the debug browser, the connection and the teardown. Use it when the chrome-devtools tools
  can't connect, or on a new machine.
---

# Chrome DevTools MCP across the WSL boundary

Connect the `chrome-devtools` MCP server, which [`.mcp.json`](../../../.mcp.json) registers, to a
debug Chrome on the Windows host, so you can script, screenshot and inspect the app in the browser
it ships to. Chrome listens for DevTools only on the Windows loopback, which WSL in NAT mode can't
reach, so a Windows port proxy forwards port 9223 to Chrome's port 9222. Ask the user to run each
PowerShell block, because it needs an administrator shell you can't open from WSL. The work is done
when `list_pages` answers with the debug browser's tabs.

The proxy gives full control of the debug browser to anything that can reach port 9223, because the
browser starts with `--remote-allow-origins=*`. Run the debug browser on its own empty profile,
never the user's daily one. When your task no longer needs the browser, close it and ask the user to
remove the proxy.

## Key rules

- [Mistakes to avoid](#mistakes-to-avoid): check the networking mode first, scope the firewall rule
  to `172.16.0.0/12`, and never use the daily profile.
- [Add the proxy](#add-the-proxy): once per machine, a port proxy and a firewall rule.
- [Launch the debug browser](#launch-the-debug-browser): a new Chrome on its own profile, then a
  check from WSL.
- [Connect](#connect): ask the user to run `/mcp`, then check `list_pages`.
- [Remove the proxy](#remove-the-proxy): when the task no longer needs the browser.

## Mistakes to avoid

- **Mirrored networking needs no proxy.** Run `wslinfo --networking-mode` first. When it prints
  `mirrored`, WSL shares the Windows loopback: skip the proxy, and ask the user before you change
  `--browser-url` in `.mcp.json` to `http://127.0.0.1:9222`.
- **A firewall rule for one subnet stops working after a reboot.** WSL takes a new NAT subnet from
  `172.16.0.0/12` at each boot. Keep the rule's remote address as that whole range.
- **Chrome ignores `--remote-debugging-port` when it joins a running instance.** A separate
  `--user-data-dir` makes it start a new instance. Close any debug browser left from an earlier run
  before you launch one.
- **The server needs no change after a reboot.** The command in `.mcp.json` reads the Windows host's
  address from the WSL default gateway each time the server starts.

## Add the proxy

Do this once per machine, or again after you remove the proxy.

1. Ask the user to run this in PowerShell as administrator:

   ```powershell
   netsh interface portproxy add v4tov4 listenport=9223 listenaddress=0.0.0.0 connectport=9222 connectaddress=127.0.0.1
   ```

   Expect: `netsh interface portproxy show v4tov4` lists port 9223 forwarded to `127.0.0.1:9222`.

2. Ask the user to run this in PowerShell as administrator:

   ```powershell
   New-NetFirewallRule -DisplayName 'WSL chrome-debug 9223' -Direction Inbound -LocalPort 9223 -Protocol TCP -Action Allow -RemoteAddress 172.16.0.0/12
   ```

   Expect: PowerShell prints the new rule with `Enabled : True`.

## Launch the debug browser

Launch Chrome on its own profile folder. From WSL, run:

```bash
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --remote-allow-origins='*' --user-data-dir='C:\temp\chrome-vers-debug' &
```

Check the proxy from WSL:

```bash
curl -s "http://$(ip route show default | awk '{print $3; exit}'):9223/json/version"
```

Expect: a JSON body that opens with `"Browser": "Chrome/…"`. When the body is empty and
`netsh interface portproxy show v4tov4` lists port 9223, ask the user to check the firewall rule.
When the list is empty, add the proxy again.

## Connect

A Claude Code session that starts while the proxy is up connects on its own. In a running session,
ask the user to run `/mcp` and reconnect `chrome-devtools`. Then call `list_pages`. Expect: the
debug browser's open tabs.

## Remove the proxy

Close the debug browser, then ask the user to run this in PowerShell as administrator:

```powershell
netsh interface portproxy delete v4tov4 listenport=9223 listenaddress=0.0.0.0
Remove-NetFirewallRule -DisplayName 'WSL chrome-debug 9223'
```

Leave the profile folder at `C:\temp\chrome-vers-debug` for the next run.
