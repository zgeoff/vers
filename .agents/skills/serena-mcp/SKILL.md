---
name: serena-mcp
description:
  Sets up, checks or restarts the shared serena MCP daemon that serves symbol lookups to every
  Claude Code session on this machine. Use it when the serena tools can't connect, on a new machine,
  or when a lookup misses a symbol you can see in the code.
---

# Serena MCP as a shared daemon

Keep one serena daemon running for every Claude Code session on the machine, and get the `serena`
tools working again when they fail. The daemon answers symbol lookups (a file's outline, a
definition, its references) on `http://127.0.0.1:9121/mcp`, and [`.mcp.json`](../../../.mcp.json)
registers that URL, so no session starts its own copy, which would take about 740 MB of memory. The
daemon runs as a systemd user unit. The work is done when `get_symbols_overview` answers for a
TypeScript file.

Ask the user before you enable lingering, which starts their systemd user manager at boot, or the
unit: both keep a process running on their machine across logout and reboot.

## Key rules

- [Mistakes to avoid](#mistakes-to-avoid): look up worktree symbols by text search, edit with the
  built-in tools, and restart after a config change.
- [Commands](#commands): check the unit, read its log, restart it, probe the endpoint.
- [Set up the daemon](#set-up-the-daemon): once per machine, with the user's agreement.
- [Connect](#connect): ask the user to run `/mcp`, then check `get_symbols_overview`.

## Mistakes to avoid

- **The daemon indexes the primary checkout, never a worktree.** The primary checkout is the first
  path that `git worktree list` prints. A symbol that only a worktree branch has is missing from
  every lookup, so find it with Grep.
- **The serena tools can't edit.** An edit through the daemon would land in the primary checkout, so
  [`.serena/project.yml`](../../../.serena/project.yml) makes the project read-only and
  [`.serena/context.claude-code.yml`](../../../.serena/context.claude-code.yml) drops every editing,
  file and shell tool. Make each code change with the built-in edit tools. When an editing tool
  shows up in the tool list, the daemon didn't load the context file: restart it.
- **The daemon reads its config only at startup.** After a change to either `.serena/` file, restart
  it. After a change to the unit file, run `systemctl --user daemon-reload` first.

## Commands

| Task               | Command                               | Needs            |
| ------------------ | ------------------------------------- | ---------------- |
| Check the unit     | `systemctl --user status serena-mcp`  | the unit file    |
| Read the log       | `journalctl --user -u serena-mcp`     | the unit file    |
| Restart            | `systemctl --user restart serena-mcp` | the unit file    |
| Probe the endpoint | the `curl` command below              | a running daemon |

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:9121/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
```

Expect: `200`. `000` means nothing listens on the port: check the unit. Any other code means the
daemon runs but fails: read the log.

When the serena tools can't connect, check the unit first. When it isn't found, set up the daemon.
When it is inactive or failed, read the log, then restart it.

## Set up the daemon

Do this once per machine, after the user agrees.

1. Let the user's systemd manager start at boot and outlive the login session:

   ```bash
   loginctl enable-linger "$USER"
   ```

   Expect: `loginctl show-user "$USER" -p Linger` prints `Linger=yes`.

2. Write the unit to `~/.config/systemd/user/serena-mcp.service`. Replace `<checkout_path>`, in both
   places, with the primary checkout's absolute path. Replace `<uvx_path>` with what
   `command -v uvx` prints. Change the serena version only here: `.mcp.json` names only the URL, so
   the unit is the one place that pins it.

   ```ini
   [Unit]
   Description=Serena MCP daemon for vers

   [Service]
   WorkingDirectory=<checkout_path>
   ExecStart=<uvx_path> --from serena-agent==1.7.0 serena start-mcp-server --transport streamable-http --host 127.0.0.1 --port 9121 --project <checkout_path> --context .serena/context.claude-code.yml --open-web-dashboard false
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=default.target
   ```

3. Enable and start the unit:

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now serena-mcp
   ```

   Expect: `systemctl --user status serena-mcp` shows `active (running)`.

4. Run the probe in [Commands](#commands). Expect: `200`.

## Connect

A Claude Code session that starts while the daemon runs connects on its own. In a running session,
ask the user to run `/mcp` and reconnect `serena`. Then call `get_symbols_overview` on any
TypeScript file. Expect: the file's symbols.
