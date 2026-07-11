# Database

Where postgres lives, how everything connects to it, and how to re-provision it from nothing.

## The Neon project

One Neon project holds the identity database; services and migrations all point at it.

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Project         | `vers` (`patient-dust-07220142`), org `Geoff`      |
| Region          | `aws-ap-southeast-2` (Sydney)                      |
| Postgres        | 17                                                 |
| Branch          | `main` (default)                                   |
| Database        | `vers`, owned by `neondb_owner`                    |
| Compute         | 0.25 CU fixed, scale-to-zero                       |
| Suspend timeout | 300s — free-plan fixed; the flag to change it 403s |

Idle compute resumes on the next connection (~0.6–1.1s observed from a Fly Sydney machine; warm
queries ~2ms, fresh connections ~55–70ms). Fly idle-stop timing must not equal the 300s suspend
window, or a first request after idle pays both cold starts at once — set Fly's idle-stop
meaningfully longer or shorter when provisioning apps.

## Activity checkpoint store

The activities service owns two tables in this Postgres. `activities` is a head row per activity
stream, carrying the appended and verified cursors plus their timestamps; a partial unique index
allows only one active row per avatar at a time. `activity_checkpoints` is a plain, append-only log
keyed by `(activity_id, version)`.

The head row's compare-and-swap is the log's whole concurrency contract: appending a batch updates
`activities` with a `WHERE appended_head = <expected>` clause, and only a matching row's update
inserts the batch's checkpoint rows, in the same transaction. A losing race updates zero rows and
reports the row's current head back to the caller instead of corrupting the stream.

`activity_checkpoints` carries no foreign keys pointing into it and no uniqueness constraint beyond
its own primary key, so it is partition-ready by construction: time-range partitioning with
retention that drops whole partitions of already-verified, cold-archived streams is a storage
change, not a schema or contract change.

## Connection strings

Two hosts per endpoint: **direct** (`ep-<endpoint>.<region>.aws.neon.tech`) and **pooled**
(`ep-<endpoint>-pooler.…`, PgBouncer in transaction mode).

- Always pin `sslmode=verify-full`. Neon hands out `sslmode=require` by default, which trips a
  deprecation warning in `pg-connection-string` (used by kysely-codegen's introspection), and
  `verify-full` is the correct setting regardless — Neon's certificates chain to public CAs, so no
  extra CA bundle is needed.
- Drop the `channel_binding=require` parameter neonctl appends — postgres.js does not understand it.
- Everything uses the **direct** host. The pooled host requires `prepare: false` in postgres.js
  (PgBouncer transaction mode breaks prepared statements); switch to it only if connection pressure
  appears, and set that option when doing so.

## Who connects, and where the string lives

Three consumers, three stores — the string never lives in the repo:

| Consumer                       | String | Store                                                          |
| ------------------------------ | ------ | -------------------------------------------------------------- |
| Services at runtime (Fly)      | direct | `fly secrets set DATABASE_URL=…` per app, at provisioning time |
| CI migrations (`main.yml`)     | direct | `DATABASE_URL` repository Actions secret                       |
| Local dev (kysely-ctl, ad hoc) | direct | `libs/data/db/.env.local` (gitignored)                         |

Migrations run as a single `main.yml` step on a fully green run, not a Fly `release_command`:
several services share the one database, and a per-service release command would run the same
migrations once per deploy, redundantly and concurrently. Deploy jobs order after the migrate step.

Services never read `process.env` for this themselves — each service's `envShape` declares
`DATABASE_URL` and its factory passes the parsed value to `createDB` (`@vers/db`).

## Local dev

`libs/data/db/.env.local` holds `DATABASE_URL` pointing at the Neon `main` branch. Pass it
explicitly when running the kysely-ctl scripts — bun's automatic `.env` loading covers bun's own
process but does not reach the node-shebang `kysely` binary a package script spawns:

```sh
cd libs/data/db
bun --env-file=.env.local run db:migrate   # also db:seed, db:rollback
```

`db:codegen` is broken under the workspace's TypeScript 7; regenerate through an isolated
kysely-codegen + TS5 install.

For isolated experiments, branch the database instead of sharing `main`:

```sh
neonctl branches create --project-id patient-dust-07220142 --name <name>
neonctl connection-string <name> --project-id patient-dust-07220142 --database-name vers
```

A branch is a full copy-on-write postgres — run migrations against it, introspect it with
`db:codegen`, delete it when done (`neonctl branches delete`).

## Re-provisioning from nothing

The whole setup reduces to four commands (neonctl authenticated via `neonctl auth`):

```sh
neonctl projects create --name vers --region-id aws-ap-southeast-2 \
  --org-id org-long-snow-12176298 --pg-version 17
neonctl databases create --project-id <new-id> --name vers --owner-name neondb_owner
neonctl connection-string main --project-id <new-id> --database-name vers
# then: rewrite sslmode to verify-full, drop channel_binding, and distribute to the consumer stores
```

After provisioning, write the string into `libs/data/db/.env.local`, then `db:migrate` and `db:seed`
(run with `--env-file=.env.local`) bring the schema and dev seed data up from zero. Update the
`DATABASE_URL` Actions secret and each Fly app's secret to the new string.
