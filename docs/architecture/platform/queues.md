# Queues

Durable background work runs on Postgres-backed job queues. pg-boss is the queue engine, and every
package consumes it only through `@vers/jobs`. A queue buys 3 things a request path cannot: delivery
that survives a failed downstream call or a dead process, retries with backoff, and a dead-letter
trail. Work that needs none of those does not belong on a queue. The email service
(`services/email`) is the reference consumer.

## The wrapper

`@vers/jobs` is the only module that imports pg-boss, so every other package reaches queues through
it.

- `defineJobs` declares a record mapping each job name to its
  `{ schema, retryLimit, retryDelay, retryBackoff, deadLetter }`. The schema is a zod schema, and
  the job name doubles as the queue name.
- `createJobQueue(defs, config)` returns `start`, `stop`, `send`, and `drain`. The `config` carries
  the connection string, the per-job `handlers`, and optional `onError` and `onJobFailed` reporting
  callbacks. Every defined job needs a handler, and the handler receives the schema-parsed payload
  alongside a `{ jobID }` context.
- `send` validates the payload before it enqueues and returns the pg-boss job id. Pass its `trx`
  option to route the insert through the caller's Kysely transaction, so job creation commits or
  rolls back with the domain write it belongs to.
- `drain(name?)` runs one fetch/handle/complete loop and returns `{ completed, failed }`. When a
  stored payload no longer parses, the drain fails it without ever reaching the handler.
- pg-boss owns the `pgboss` schema in the shared Neon database and migrates it itself at `start()`,
  so the `@vers/db` migrations never touch it.

## Delivery model: drains, not resident workers

Fleet services scale to zero when idle, and Neon suspends the database. A resident polling worker
would hold both awake around the clock, so delivery rides three one-shot drains instead.

- **Nudge** — an enqueue procedure fires `drain(name)` fire-and-forget after the insert. The machine
  handling the request is already awake, so delivery lands within milliseconds.
- **Boot drain** — the serve entrypoint drains on start, catching jobs enqueued while the process
  was down.
- **Hourly sweep** — a Fly scheduled machine runs the service's sweep binary: start the queue, drain
  to completion, exit. It catches retries whose delay elapsed while no machine was awake, and
  anything a crash orphaned. The deploy CLI declares and reconciles the machine
  ([deployment](./deployment.md)).

Durability lives in Postgres, so a job between drains is late, never lost.

A queue-hosting service stops when idle (`auto_stop_machines = 'stop'`) like every app that holds a
Postgres pool ([topology](./deployment.md#topology)), and its clean boot re-runs the boot drain. A
suspended pg-boss process would also resume with a clock jump under its maintenance timers.

## Retries and failure

- A handler throw fails the job. pg-boss keeps it invisible until `retryDelay` elapses, doubling
  that delay per attempt when `retryBackoff` is set. `retryBackoff` takes effect only when
  `retryDelay` is set explicitly.
- A job that exhausts `retryLimit` on a `deadLetter: true` definition moves to `<name>.dead`,
  drainable and redrivable through the same API.
- Handlers make outbound effects idempotent with the job id, so at-least-once delivery never doubles
  an effect. The email service sends the job id as Resend's idempotency key.

## Testing

Real postgres, database per test: `createDatabaseFromTemplate()` hands the queue its own connection
string, because pg-boss pools its own connections and cannot run inside an injected transaction
handle.

The tests in `@vers/jobs` own retry and dead-letter timing. A consumer's suite asserts that a failed
job survives and stays invisible during backoff, never wall-clock redelivery.
