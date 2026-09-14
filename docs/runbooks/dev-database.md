# Dev database

How a local checkout and an agent session reach a database to develop against: the shared `main`
branch for migrations and scripts, a Neon branch for an isolated experiment, and a per-worktree
clone for MCP sessions. [Database](../architecture/platform/database.md) owns the topology and the
connection rules.

## Local dev

`libs/data/db/.env.local` (gitignored) holds `DATABASE_URL` pointing at the Neon `main` branch. Pass
it explicitly when running the kysely-ctl scripts: bun's automatic `.env` loading covers bun's own
process but does not reach the node-shebang `kysely` binary a package script spawns.

```sh
cd libs/data/db
bun --env-file=.env.local run db:migrate   # also db:seed, db:rollback
```

`db:codegen` does not run under the workspace's TypeScript 7. Regenerate through an isolated
kysely-codegen install pinned to TypeScript 5.

For isolated experiments, branch the database instead of sharing `main`:

```sh
neonctl branches create --project-id patient-dust-07220142 --name <name>
neonctl connection-string <name> --project-id patient-dust-07220142 --database-name vers
```

A branch is a full copy-on-write postgres. Run migrations against it, introspect it with
`db:codegen`, and delete it when done (`neonctl branches delete`).

## Per-worktree dev databases

A worktree's database is named `dev_<machine>_<branch>`, both fragments sanitized to `[a-z0-9_]`.
The machine fragment (from the hostname) is capped at 16 chars. A name over postgres's 63-byte
identifier limit is truncated and suffixed with a hash of the raw machine/branch pair.

The first dev tool call of a session provisions the database through dbhub's `init_command`. It
clones the template (`CREATE DATABASE … TEMPLATE dev_base`), stamps machine, branch, and creation
time as a database comment, then migrates the clone forward. An existing database therefore catches
up with migrations that landed after the template was last refreshed.

- `dev_base` is the migrated, seeded clone template. `bun run pg:dev:refresh-base` rebuilds it
  (drop, create, migrate, seed) and leaves existing clones untouched. Run it when seed data changes.
- `bun run pg:dev:sweep` drops this machine's databases whose branch no longer exists locally. The
  machine prefix scopes the sweep, so one machine's sweep can never drop another's databases, and
  `dev_base` never matches the prefix.
- Provisioning and sweeping connect to `vers` on the dev branch, never to `dev_base`: postgres
  refuses to clone a template that has open connections.
- `dev_base` refuses connections outright (`ALLOW_CONNECTIONS false`, like template0) except during
  a rebuild. Neon parks invisible backends on recently connected databases for minutes, and any
  session on the template blocks cloning. Neon's compute also opens short-lived internal sessions
  while waking from scale-to-zero, so provisioning retries a busy-template failure briefly.
