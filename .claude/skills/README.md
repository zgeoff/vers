# Skills

Project skills auto-discovered by agents working in this repo. Each skill is a directory holding a
`SKILL.md` entry point.

## Vendored Neon skills

Three skills are vendored from
[neondatabase/agent-skills](https://github.com/neondatabase/agent-skills) at commit
`53566ea4057c7381749c745544819403ff692862`, licensed [Apache-2.0](./neon-skills-LICENSE.txt).
Content is upstream's; only markdown line-wrapping was reflowed to repo style (`bun run format`).

- `neon-postgres-egress-optimizer` — diagnose and cut Postgres network data transfer (egress); the
  tooling behind our own Neon egress work.
- `neon-postgres-branches` — pick and create the right Neon branch type; matches our per-worktree
  dev databases and migration-testing workflow.
- `neon-postgres` — Neon connection, pooling, scale-to-zero, and CLI/MCP best practices.

Neon's other published skills (platform overview, Object Storage, AI Gateway, Functions, claimable
Postgres) cover services this project does not use and are not vendored. Refresh a vendored skill by
re-copying its `SKILL.md` from a newer upstream commit, running `bun run format`, and bumping the
SHA above.
