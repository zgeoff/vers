# Spike #159 — kysely migration tooling

**Status: spike — never merges.** Findings are encoded in the #159 issue comment; this branch is
the runnable reference. Close the PR once the decisions land in the rebuild issues (#162/#163/#164).

## Verdict

**kysely-ctl + kysely-codegen.** All four scope items pass; the `users` table is ported as the
proof migration (exit criteria met).

| Concern | Decision |
| --- | --- |
| Migration runner | **kysely-ctl** (0.21.0) — TS config, `migrate:latest/down/rollback/list`, wraps kysely's own `Migrator` |
| Type generation | **kysely-codegen** (0.20.0) from the live DB with `--camel-case`, paired with `CamelCasePlugin` |
| Seeds | **kysely-ctl first-class seeds** (`kysely seed make/run`) — reruns every invocation (no bookkeeping), so seeds must be idempotent (`ON CONFLICT DO NOTHING`) |
| Dialect | **kysely-postgres-js** (3.0.0) over the existing postgres.js driver — same driver in migrations and runtime. `pg` is a dev-only dep for codegen's introspection |

## What was proven here

```
kysely migrate:latest   # ports users (drizzle 0000–0011 final shape, incl. #125 seed column)
kysely-codegen --camel-case --out-file src/schema.generated.ts
kysely seed run         # dev user with seed=1337, idempotent — ran twice to prove it
tsx verify.ts           # typed insert/select round-trip, defaults asserted → VERIFY OK
kysely migrate down && kysely migrate:latest   # rollback cycle clean
```

Workflow order matters: **migrate → codegen → seed** — seed files are typed against the generated
schema, so codegen sits between.

## Where the runner lives after `db-postgres` retires

Migrations move into the owning service's package in the new workspace (identity service for
`users`; the activities service owns its own Emmett tables per #158). Deploy runs
`kysely migrate:latest` with `DATABASE_URL` pointing at Neon — as a Fly `release_command` or a CI
step before deploy. No standalone migration app needed; kysely-ctl is a dev/CI dependency, not a
runtime one.

## Neon branching interplay (#162)

Introspection-based codegen is the right pairing for Neon: every dev branch is a real Postgres to
introspect. Per-feature workflow: create a Neon branch → `kysely migrate:latest` against the branch
URL → codegen off the branch → PR merge runs migrations against the main database. kysely-ctl takes
`DATABASE_URL` from env, so per-branch URLs drop straight in. Committed generated types + a CI
regenerate-and-diff step catches drift.

## Alternatives rejected

- **Bare kysely `Migrator` script** (today's `migrate.ts` shape) — kysely-ctl is exactly this plus
  CLI ergonomics and seeds; no reason to hand-roll.
- **Atlas** — declarative HCL toolchain; a second schema language for a solo project is overhead.
- **graphile-migrate / dbmate** — raw-SQL workflows; loses the typed migration DSL and the
  postgres.js driver reuse.
- **Schema-in-code typegen** (prisma-kysely style) — reintroduces the dual source of truth that
  migrations-as-truth + introspection avoids.

## Gotchas for #164

- drizzle's `$onUpdate` on `updated_at` is application-level, not DDL. Kysely has no equivalent —
  pick a trigger or set the column in update queries when porting identity services.
- kysely-codegen excludes the `kysely_migration*` bookkeeping tables by default and infers the
  postgres dialect from `DATABASE_URL` — zero config needed.
- Seeds are untracked by design; write every seed idempotent from day one.
- This spike's `spike/` directory is outside every tsconfig/lint path — files here run via `tsx`
  only.

## Reproducing locally

Needs any Postgres 16 at `DATABASE_URL` (this spike used standalone zonky binaries on
`localhost:55432` because docker was unavailable). Then, from this directory:

```sh
DATABASE_URL=postgres://… yarn kysely migrate:latest
DATABASE_URL=postgres://… yarn kysely-codegen --camel-case --out-file src/schema.generated.ts
DATABASE_URL=postgres://… yarn kysely seed run
DATABASE_URL=postgres://… yarn tsx verify.ts
```
