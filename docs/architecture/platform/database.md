# Database

Vers runs on one Neon-hosted Postgres. One Neon project holds the identity database, and every
service and migration points at it. A second Neon branch backs disposable per-worktree databases
that agent MCP sessions clone on demand. The compute scales to zero when idle, so the first
connection after a suspend pays a resume cost.

## The Neon project

| Property        | Value                                         |
| --------------- | --------------------------------------------- |
| Project         | `vers` (`patient-dust-07220142`), org `Geoff` |
| Region          | `aws-ap-southeast-2` (Sydney)                 |
| Postgres        | 17                                            |
| Branch          | `main` (default)                              |
| Database        | `vers`, owned by `neondb_owner`               |
| Compute         | autoscaling 0.25–8 CU, scale-to-zero          |
| Suspend timeout | 300s (Neon's default; `suspend_timeout` 0)    |

The project, branches, compute endpoints, and roles are declared in the vers-infra Pulumi program
(`infra/neon.ts`), applied with `pulumi up` from `infra/` and drift-checked by the infra-drift
workflow. Databases, schemas, and migrations stay with the migration pipeline, and each role's
in-database grants are SQL — the Neon API models role existence, not privileges.

Idle compute resumes on the next connection. A resume runs ~0.6–1.1s, observed from a Fly Sydney
machine; once warm, queries run ~2ms and fresh connections ~55–70ms. Fly's idle-stop timing must not
equal the 300s suspend window: a first request after idle would then pay both cold starts at once.
Set Fly's idle-stop meaningfully longer or shorter when provisioning apps.

## Activity checkpoint store

The activities service owns two tables in this database: `activities` (the per-stream head row) and
the append-only `activity_checkpoints`. Their cursors and concurrency contract belong to the feature
— the [checkpoint streams](../game/game-simulation.md#checkpoint-streams) and the
[overview](../overview.md). The head row timestamps each cursor's last advance in an `appended_at`
and a `verified_at` column. A partial unique index on `activities` permits one `active` row per
avatar at a time. An append's checkpoint rows insert only within the transaction whose head-row
update wins the compare-and-swap, so a losing append inserts nothing.

`activity_checkpoints` stays in Postgres and stays cheap to scale there. Append-heavy submissions,
point reads for the latest progress off the head row, and full-stream replays by the verifier are a
natural fit for its indexes. The table carries no inbound foreign keys and no global uniqueness
constraint, so time-range partitioning with a retention window that cold-archives verified streams
to object storage is a storage change, not a schema change.

## Connection strings

Each Neon endpoint has two hosts: **direct** (`ep-<endpoint>.<region>.aws.neon.tech`) and **pooled**
(`ep-<endpoint>-pooler.…`, PgBouncer in transaction mode).

- Pin `sslmode=verify-full` always. Neon defaults to `sslmode=require`, which trips a deprecation
  warning in `pg-connection-string` (used by kysely-codegen's introspection). `verify-full` is the
  correct setting regardless: Neon's certificates chain to public CAs, so no extra CA bundle is
  needed.
- Drop the `channel_binding=require` parameter neonctl appends. postgres.js does not understand it.
- Everything uses the direct host. The pooled host requires `prepare: false` in postgres.js, because
  PgBouncer transaction mode breaks prepared statements. Switch to the pooled host only if
  connection pressure appears, and set `prepare: false` when doing so.

## Who connects, and where the string lives

Every consumer has its own store, and the string never lives in the repo.

| Consumer                       | String | Store                                                          |
| ------------------------------ | ------ | -------------------------------------------------------------- |
| Services at runtime (Fly)      | direct | `fly secrets set DATABASE_URL=…` per app, at provisioning time |
| CI migrations (`main.yml`)     | direct | `DATABASE_URL` repository Actions secret                       |
| Local dev (kysely-ctl, ad hoc) | direct | `libs/data/db/.env.local` (gitignored)                         |
| Agent MCP sessions (dbhub)     | direct | 1Password `vers` vault items `neon-mcp-ro` and `neon-mcp-dev`  |

Services never read `process.env` for the connection string. Each service's `envShape` declares
`DATABASE_URL`, and its factory passes the parsed value to `createDB` (`@vers/db`).

CI applies migrations once per green push in a dedicated `migrate` job that deploy jobs wait on,
never as a per-service Fly `release_command` — [deployment](./deployment.md#pipeline) owns the
scheduling.

## Local dev

`libs/data/db/.env.local` (gitignored) holds `DATABASE_URL` pointing at the Neon `main` branch. Pass
it explicitly when running the kysely-ctl scripts: bun's automatic `.env` loading covers bun's own
process but does not reach the node-shebang `kysely` binary a package script spawns.

```sh
cd libs/data/db
bun --env-file=.env.local run db:migrate   # also db:seed, db:rollback
```

`db:codegen` is broken under the workspace's TypeScript 7. Regenerate through an isolated
kysely-codegen + TS5 install.

For isolated experiments, branch the database instead of sharing `main`:

```sh
neonctl branches create --project-id patient-dust-07220142 --name <name>
neonctl connection-string <name> --project-id patient-dust-07220142 --database-name vers
```

A branch is a full copy-on-write postgres. Run migrations against it, introspect it with
`db:codegen`, and delete it when done (`neonctl branches delete`).

## Agent access (MCP)

The `postgres` entry in `.mcp.json` runs `scripts/src/bin/pg-mcp-launch.ts`. That launcher renders a
per-session dbhub config — DSNs read from 1Password, the dev source pinned to the worktree's
database — and hands stdio to `@zgeoff/dbhub`. Both sources are lazy: a session that never queries
postgres never opens a connection, and Neon stays suspended.

- The `prod` source queries `vers` on the `main` branch as `mcp_ro`. Read-only holds at two
  independent layers: dbhub's readonly tool mode refuses non-SELECT statements, and the role has
  SELECT-only grants with `default_transaction_read_only = on`. A write is refused even if the tool
  layer fails.
- The `dev` source connects to the `dev` branch as `mcp_dev` (`LOGIN CREATEDB`). Each session is
  pinned to its worktree's own database, so concurrent agent sessions on different branches never
  share state.

### Per-worktree dev databases

A worktree's database is named `dev_<machine>_<branch>`, both fragments sanitized to `[a-z0-9_]`.
The machine fragment (from the hostname) is capped at 16 chars. A name over postgres's 63-byte
identifier limit is truncated and suffixed with a hash of the raw machine/branch pair.

The first dev tool call of a session provisions the database through dbhub's `init_command`. It
clones the template (`CREATE DATABASE … TEMPLATE dev_base`), stamps machine, branch, and creation
time as a database comment, then migrates the clone forward. An existing database thus catches up
with migrations that landed after the template was last refreshed.

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

### Provisioning agent access from nothing

The `dev` branch and both roles come from the Pulumi program; grants, passwords, and vault items
follow by hand.

1. Apply the program — it declares the `dev` branch and the `mcp_ro` and `mcp_dev` roles.

   ```sh
   cd infra && op run --env-file=.env -- pulumi up
   ```

2. Grant the read-only role as `neondb_owner` against `vers` on `main`.

   ```sql
   GRANT USAGE ON SCHEMA public TO mcp_ro;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_ro;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_ro;
   ALTER ROLE mcp_ro SET default_transaction_read_only = on;
   ```

3. Grant the dev role as `neondb_owner` against `vers` on `dev`.

   ```sql
   ALTER ROLE mcp_dev CREATEDB;
   ```

4. Mint each role's password (`neonctl roles reset-password` or the console), store both DSNs, and
   build the template. Both point at the `vers` database with `sslmode=verify-full` — `mcp_ro` on
   the `main` host, `mcp_dev` on the `dev` host.

   ```sh
   op item create --vault vers --category Password --title neon-mcp-ro "dsn[concealed]=<mcp_ro DSN>"
   op item create --vault vers --category Password --title neon-mcp-dev "dsn[concealed]=<mcp_dev DSN>"
   bun run pg:dev:refresh-base
   ```

## Re-provisioning from nothing

The Pulumi program creates the Neon layer (project, branches, endpoints, roles); the database and
its connection string follow with neonctl (authenticated via `neonctl auth`):

```sh
cd infra && op run --env-file=.env -- pulumi up
neonctl databases create --project-id <new-id> --name vers --owner-name neondb_owner
neonctl connection-string main --project-id <new-id> --database-name vers
# then: rewrite sslmode to verify-full, drop channel_binding, and distribute to the consumer stores
```

After provisioning, write the string into `libs/data/db/.env.local`. Then `db:migrate` and `db:seed`
(run with `--env-file=.env.local`) bring the schema and dev seed data up from zero. Update the
`database-url` field on the `vers-ci` vault's `github-actions` item (the vers-infra program pushes
it to the `DATABASE_URL` Actions secret) and each Fly app's secret to the new string.
