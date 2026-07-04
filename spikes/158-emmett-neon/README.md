# Spike 158 — Emmett event store on Neon

Time-boxed validation for [#158](https://github.com/zgeoff/vers/issues/158): proves the
checkpoint event store from the #143 evaluation (emmett-on-postgres, hosted on Neon Sydney)
before #127 builds the activities service on it. **Reference only — never merges.**

## Shape

Self-contained pnpm workspace (bun runtime), outside the repo's yarn `projects/*` glob:

- `store/` — `@vers/spike-store`: emmett PostgreSQL event store with a stream per activity
  (`activity:<id>`), hash-chain links (`prevHash`/`hash`) carried in event data, an inline pongo
  projection for "latest progress for activity X", and the verifier-path replay that recomputes
  the whole chain.
- `probe/` — `@vers/spike-probe`: elysia bench server deployed to Fly (syd) so every timing is
  measured next to the database. `POST /bench/run` drives the full scenario: create stream,
  N hash-chained batch appends with optimistic concurrency, projection point reads, full replay
  + chain verification, and a stale-version append that must be rejected.

## Run it

```sh
pnpm install
# .env needs DATABASE_URL (Neon) — see the issue for the spike project
set -a && source .env && set +a
pnpm dev:probe                 # probe on :3002
pnpm bench                     # drives PROBE_URL (default localhost:3002)
```

Fly deployment: `flyctl deploy --ha=false` with `DATABASE_URL` as a secret. The cold-start phase
of `pnpm bench` needs `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_ENDPOINT_ID` to force suspends.

## Numbers (fly syd shared-cpu-1x → Neon Sydney free tier, PG 17)

Steady state (compute warm), 200-batch scenario:

| Path                                        | Latency                        |
| ------------------------------------------- | ------------------------------ |
| Append (txn incl. inline projection)        | p50 17.1ms · p95 18.7ms        |
| Projection point read (latest progress)     | p50 2.0ms · p95 2.4ms          |
| Full replay + chain verify (201 events)     | 41ms (51 events: ~9ms)         |
| Fresh connection (TCP+TLS+auth+query), warm | ~55–70ms                       |

Scale-to-zero (endpoint suspended via API, measured on next request):

| Path                                | Latency                       |
| ----------------------------------- | ----------------------------- |
| Cold read through existing pool     | ~600–625ms                    |
| Cold fresh connection               | ~1.1s                         |
| Cold first write (stream create)    | ~770–790ms                    |
| Worst observed full-stack cold path | 12.7s (one-off, see verdict)  |

Optimistic concurrency: stale `expectedStreamVersion` rejected on every run
(`ExpectedVersionConflictError`).

## Verdict

**Go.** See the findings comment on #158 for detail and caveats (fixed emmett schema — chain
lives in event data, not columns; `instanceof` hazard on emmett errors across its bundled dist,
use `isExpectedVersionConflictError`; the 12.7s outlier stacked fly machine cold boot + first
schema-migration check + Neon resume — mitigations noted there).
