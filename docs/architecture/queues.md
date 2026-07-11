# Queues

Durable background work runs on Postgres-backed job queues: pg-boss under the hood, consumed only
through `@vers/jobs`. A queue buys three things a request path can't: delivery that survives a
failed downstream call or a dead process, retries with backoff, and a dead-letter trail. Work that
needs none of those doesn't belong on a queue.

## The wrapper

`@vers/jobs` is the only module that imports pg-boss.

- `defineJobs` declares a record of job name →
  `{ schema, retryLimit, retryDelay, retryBackoff, deadLetter }`. The schema is zod; the job name is
  the queue name.
- `createJobQueue(defs, { connectionString, handlers, onError })` returns `start`, `stop`, `send`,
  and `drain`. Every defined job requires a handler, which receives the schema-parsed payload and a
  `{ jobID }` context.
- `send` validates the payload before enqueue and returns the pg-boss job id. Its `trx` option
  routes the insert through the caller's Kysely transaction, so job creation commits or rolls back
  with the domain write it belongs to.
- `drain(name?)` is a one-shot fetch/handle/complete loop returning `{ completed, failed }`. A
  stored payload that no longer parses is failed without reaching the handler.
- pg-boss owns the `pgboss` schema in the shared database and migrates it itself at `start()`;
  `@vers/db` migrations never touch it.

## Delivery model: drains, not resident workers

Fleet services scale to zero and Neon suspends when idle — a resident polling worker would hold both
awake around the clock. Delivery instead rides three one-shot drains:

1. **Nudge** — an enqueue procedure fires `drain(name)` fire-and-forget after the insert. The
   machine handling the request is already awake, so delivery lands within milliseconds.
2. **Boot drain** — the serve entrypoint drains on start, catching jobs enqueued while the process
   was down.
3. **Hourly sweep** — a Fly scheduled machine (`--schedule hourly`) runs the service's sweep binary:
   start the queue, drain to completion, exit. It catches retries whose delay elapsed while no
   machine was awake, and anything a crash orphaned.

Durability lives in Postgres, so a job between drains is late, never lost.

A queue-hosting service sets `auto_stop_machines = 'stop'` rather than the fleet's `'suspend'`: a
suspended process resumes with stale pool sockets and a clock jump under pg-boss's timers, while a
clean boot re-runs the boot drain.

## Retries and failure

- A handler throw fails the job; pg-boss keeps it invisible until `retryDelay` elapses, doubling per
  attempt when `retryBackoff` is set. `retryBackoff` only takes effect when `retryDelay` is set
  explicitly.
- A job that exhausts `retryLimit` on a `deadLetter: true` definition moves to `<name>.dead`,
  drainable and redrivable through the same API.
- Handlers make outbound effects idempotent with the job id — the email service sends it as Resend's
  idempotency key — so at-least-once delivery never doubles an effect.

## Testing

Real postgres, database per test: `createDatabaseFromTemplate()` hands the queue its own connection
string, because pg-boss pools its own connections and cannot run inside an injected transaction
handle. Retry and dead-letter timing are `@vers/jobs`'s tested contract — a consumer's suite asserts
that a failed job survives and stays invisible during backoff, not wall-clock redelivery.

The email service (`services/email`) is the reference consumer.
