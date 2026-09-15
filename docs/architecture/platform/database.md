# Database

Vers runs on one Neon project. Its `main` branch holds the shared database, `vers`, which every
service and migration points at: the identity tables, the activity checkpoint tables, the job queue,
and the release and sim-version registries. The same branch holds the separate databases the error
tracker and the analytics dashboard own. A second branch, `dev`, backs disposable per-worktree
databases that agent MCP sessions clone on demand ([dev database](../../runbooks/dev-database.md)).
The compute scales to zero when idle, so the first connection after a suspend pays a resume.

## The Neon project

The vers-infra Pulumi program declares the project, branches, compute endpoints, and roles, and the
infra-drift workflow checks them for drift. Databases, schemas, and migrations stay with the
migration pipeline ([deployment](./deployment.md#pipeline)). Each role's in-database grants are SQL,
because the Neon API models role existence, not privileges. Fly's idle-stop timing must not equal
Neon's suspend window, or a first request after idle pays both cold starts at once.

## Activity checkpoint store

The activity service owns the activity checkpoint tables: a head row per activity and an append-only
checkpoint table. The cursors those rows carry and the rules that advance them belong to
[checkpoint streams](../game/game-simulation.md#checkpoint-streams). The storage facts: the head row
timestamps each cursor's last advance, a partial unique index permits one `active` row per avatar at
a time, and the checkpoint table carries no inbound foreign keys and no uniqueness constraint beyond
its activity-and-position key.

## Connection strings

Each Neon endpoint has a direct host and a pooled host (PgBouncer in transaction mode). Every
consumer uses the direct host with `sslmode=verify-full`. Neon's certificates chain to public CAs,
so no extra CA bundle is needed, and the pooled host breaks prepared statements unless the driver
disables them. Drop the `channel_binding` parameter neonctl appends, which postgres.js does not
understand.

Every consumer has its own store for the string, and the string never lives in the repo: a Fly
secret for a service at runtime (a shared secret, [deployment](./deployment.md#shared-secrets)), an
Actions secret for CI migrations, a gitignored env file for local scripts, and 1Password items for
agent MCP sessions. A service never reads the string from the process env directly: its env shape
declares the key, and its factory passes the parsed value to the database factory.

## Connection pool

Every service opens one postgres.js pool through the database factory, and four settings bound how a
connection can fail while the process runs. Connection acquisition is bounded, so a Neon endpoint
that stalls on wake fails fast. Statements and idle-in-transaction sessions time out server-side, so
a lock an orphaned transaction holds dies even after a serverless process kill. An idle pooled
connection closes before Neon's suspend closes it from the server side, so the pool never hands out
a socket the endpoint already closed. One exception: the replay service lengthens its
idle-in-transaction timeout, because a replay iteration holds its claim transaction open across keys
and provider calls ([replay](../game/replay-verification.md#replay)).

None of those settings runs while the process is paused. Fly suspends an idle machine with its
memory snapshot, and timers do not run during the pause, so the pool resumes holding the sockets it
had, and Neon may have closed them in the meantime. A query written to such a socket fails, and a
query in flight when the machine suspended hangs until the kernel's TCP retransmit limit gives up.
The database factory therefore detects a resume, as a wall-clock gap between reads it takes on an
interval timer and before every acquire, and swaps in a fresh pool for new queries while destroying
the old one, which rejects every query still pending on it. The gap threshold stays above any
synchronous stretch of work that blocks the event loop, so a long replay verification never trips a
reset that would destroy its own live queries.

## Agent access (MCP)

The `postgres` MCP entry runs a launcher that renders a per-session config with DSNs read from
1Password and the dev source pinned to the worktree's database. Both sources are lazy: a session
that never queries postgres never opens a connection, and Neon stays suspended. The `prod` source
queries the shared database on `main` as a read-only role, and read-only holds at two independent
layers: the tool refuses non-SELECT statements, and the role has SELECT-only grants with read-only
transactions by default. The `dev` source connects to the `dev` branch as a role that can create
databases, and each session is pinned to its worktree's own database, so concurrent agent sessions
on different branches never share state ([dev database](../../runbooks/dev-database.md)).
