# Database

Vers runs on one Neon project. Its `main` branch holds the shared Neon database, `vers`, which every
service and migration points at: the identity tables, the activity checkpoint tables, the job queue,
the release and sim-version registries. The same branch holds the separate `bugsink` and `umami`
databases those apps own. A second branch, `dev`, backs disposable per-worktree databases that agent
MCP sessions clone on demand. The compute scales to zero when idle, so the first connection after a
suspend pays a resume cost.

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

The vers-infra Pulumi program (`infra/neon.ts`) declares the project, branches, compute endpoints,
and roles. `bun run up` from `infra/` applies them, and the infra-drift workflow checks them for
drift. Databases, schemas, and migrations stay with the migration pipeline. Each role's in-database
grants are SQL, because the Neon API models role existence, not privileges.

Idle compute resumes on the next connection. A resume runs 0.6–1.1s, observed from a Fly Sydney
machine. Once warm, a query runs about 2ms and a fresh connection 55–70ms. Fly's idle-stop timing
must not equal the 300s suspend window, or a first request after idle pays both cold starts at once.

## Activity checkpoint store

The activity service owns the activity checkpoint tables: `activities`, the per-stream head row, and
the append-only `activity_checkpoints`. The cursors those rows carry and the rules that advance them
belong to [checkpoint streams](../game/game-simulation.md#checkpoint-streams). The storage facts:
the head row timestamps each cursor's last advance in an `appended_at` and a `verified_at` column,
and a partial unique index on `activities` permits one `active` row per avatar at a time.
`activity_checkpoints` carries no inbound foreign keys and no uniqueness constraint beyond
`(activity_id, version)`.

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

## Connection pool

Every service opens one postgres.js pool through `createDB` (`@vers/db`), and five settings bound
how a connection can fail while the process runs. `connect_timeout` (10s) bounds connection
acquisition, so a Neon endpoint that stalls on wake fails in 10s instead of minutes.
`statement_timeout` and `idle_in_transaction_session_timeout` (30s each) are server-side session
settings, so a lock an orphaned transaction holds dies within 30s even after a serverless process
kill. One exception: `service-replay` lengthens `idle_in_transaction_session_timeout` to 120s
through `createDB`'s `idleInTransactionSessionTimeoutMs`, because a replay iteration holds its claim
transaction open across keys and provider calls under a 90s deadline
([replay verification](../game/replay-verification.md#replay)). `idle_timeout` (240s) closes a
pooled connection before Neon's 300s suspend closes it from the server side; otherwise the pool
hands out a socket the endpoint already closed and the first write fails with `CONNECTION_CLOSED`.

None of those settings runs while the process is paused. Fly suspends an idle machine with its
memory snapshot ([deployment](./deployment.md#topology)), and JavaScript timers do not run during
the pause, so the pool resumes holding the sockets it had, and the Neon side may have closed them in
the meantime. A query written to such a socket fails with `CONNECTION_CLOSED`, and a query that was
in flight when the machine suspended hangs until the kernel's TCP retransmit limit gives up, about
15 minutes later. `createDB` therefore detects a resume and drops the pool. The detector reads the
wall clock on a 5s interval timer and before every connection acquire, and a gap over 60s since its
last read means the process was not running. The 60s threshold keeps a synchronous stretch of work
shorter than 60s, such as a replay verification that blocks the event loop, from tripping a reset
that would destroy its own live queries.

A query whose reply never arrives is bounded by a 35s client-side deadline (`queryDeadlineMs`)
around every statement and every chunk of a streamed query. A deadline that expires drops the pool
the same way a detected resume does. A pool reset swaps in a fresh postgres.js instance for new
queries and destroys the old one, so every query still pending on it rejects with
`CONNECTION_DESTROYED`; the caller's retry policy decides a resend
([error handling](../services/error-handling.md#retry-policy)). Each reset increments
`vers.db.pool_resets` with its trigger as the `reason`
([observability](./observability.md#instrument-registry)).

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

## Agent access (MCP)

The `postgres` entry in `.mcp.json` runs `scripts/src/bin/pg-mcp-launch.ts`. That launcher renders a
per-session dbhub config — DSNs read from 1Password, the dev source pinned to the worktree's
database — and passes stdio to `@zgeoff/dbhub`. Both sources are lazy: a session that never queries
postgres never opens a connection, and Neon stays suspended.

- The `prod` source queries `vers` on the `main` branch as `mcp_ro`. Read-only holds at two
  independent layers: dbhub's readonly tool mode refuses non-SELECT statements, and the role has
  SELECT-only grants with `default_transaction_read_only = on`. A write is refused even if the tool
  layer fails.
- The `dev` source connects to the `dev` branch as `mcp_dev` (`LOGIN CREATEDB`). Each session is
  pinned to its worktree's own database, so concurrent agent sessions on different branches never
  share state.
