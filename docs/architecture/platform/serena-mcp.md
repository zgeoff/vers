# Serena MCP as a shared daemon

The `serena` MCP server gives an agent language-server symbol tools over the monorepo: a file's
symbol outline, a definition, its references and implementations, and diagnostics. One serena
process serves every Claude Code session on the machine. It listens on `127.0.0.1:9121` over
streamable HTTP, and [`.mcp.json`](../../../.mcp.json) registers it as an `http` server, so a
session opens a connection instead of spawning its own copy. A per-session serena costs about 740MB
(a Python agent, two `tsserver` processes, a typings installer, and the language-server wrapper), so
the daemon saves that much per open session.

The daemon indexes the primary checkout, not a worktree. A symbol lookup answers from the primary
checkout's tree, so a symbol a worktree branch adds or renames is invisible until the branch merges,
and a session falls back to content search for those. A symbol edit through the daemon would write
to the primary checkout rather than the worktree the session works in, so the project is read-only
([`.serena/project.yml`](../../../.serena/project.yml)) and the context
([`.serena/context.claude-code.yml`](../../../.serena/context.claude-code.yml)) excludes the editing
tools. Every code change goes through the built-in edit tools.

## Run the daemon (one-time)

A systemd user unit runs the daemon, and user lingering starts that unit at boot instead of at first
login. The unit is the serena version's owner: `.mcp.json` carries no pin because it only names the
URL. In the unit, `<checkout_path>` is the primary checkout's absolute path, the same value in both
places, and `<uvx_path>` is what `command -v uvx` prints.

1. Let the user manager start at boot and outlive the login session:

   ```bash
   loginctl enable-linger "$USER"
   ```

2. Write the unit to `~/.config/systemd/user/serena-mcp.service`:

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

3. Enable and start it:

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now serena-mcp
   ```

4. Verify the endpoint answers an MCP initialize:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:9121/mcp \
     -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
   ```

   Expect: `200`. A connection refused means the unit is down; `journalctl --user -u serena-mcp`
   holds its log.

The daemon reads the project and context files at startup, so a change to either takes effect after
`systemctl --user restart serena-mcp`.

## Connect

A Claude Code session started while the daemon is up connects on its own; in a running session,
`/mcp` reconnects the server. The working-state check is `get_symbols_overview` answering for any
TypeScript file. The tool list holds lookups only: `find_symbol`, `find_referencing_symbols`,
`find_declaration`, `find_implementations`, `get_symbols_overview`, and `get_diagnostics_for_file`.
