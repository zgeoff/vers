# Queues

Durable background work runs on Postgres-backed job queues. pg-boss is the queue engine, and every
package consumes it only through `@vers/jobs`. A queue buys three things a request path cannot:
delivery that survives a failed downstream call or a dead process, retries with backoff, and a
dead-letter trail. Work that needs none of those does not belong on a queue. The email service is
the reference consumer.

## The wrapper

`@vers/jobs` is the only module that imports pg-boss. A job definition pairs a name, which doubles
as the queue name, with a zod payload schema and the job's retry and dead-letter policy, and every
defined job needs a handler, which receives the schema-parsed payload and the job id. The queue
exposes start, stop, send, and drain. Send validates the payload before it enqueues and can route
the insert through the caller's Kysely transaction, so job creation commits or rolls back with the
domain write it belongs to. Drain runs one fetch, handle, and complete loop and fails a stored
payload that no longer parses without reaching the handler. pg-boss owns its own schema in the
shared database and migrates it itself at start, so the `@vers/db` migrations never touch it.

## Delivery model: drains, not resident workers

Fleet services scale to zero when idle, and Neon suspends the database. A resident polling worker
would hold both awake around the clock, so delivery rides three one-shot drains instead:

- Nudge: an enqueue procedure fires a drain fire-and-forget after the insert. The machine handling
  the request is already awake, so delivery lands at once.
- Boot drain: the serve entrypoint drains on start, catching jobs enqueued while the process was
  down.
- Scheduled sweep: a Fly scheduled machine runs the service's sweep binary, which starts the queue,
  drains to completion, and exits. It catches retries whose delay elapsed while no machine was
  awake, and anything a crash orphaned. The deploy CLI declares and reconciles the machine
  ([deployment](./deployment.md#scheduled-machines)).

Durability lives in Postgres, so a job between drains is late, never lost. A queue-hosting service
stops rather than suspends when idle: a suspended process resumes with stale pool sockets and a
clock jump under pg-boss's timers, where a clean boot re-runs the boot drain.

## Retries and failure

A handler throw fails the job, and pg-boss keeps it invisible until its retry delay elapses,
doubling that delay per attempt when the definition asks for backoff. A job that exhausts its retry
limit on a dead-lettering definition moves to a dead queue, drainable and redrivable through the
same API. Handlers make outbound effects idempotent with the job id, so at-least-once delivery never
doubles an effect; the email service sends the job id as its provider's idempotency key.

## Testing

A queue test runs against real postgres with a database per test, because pg-boss pools its own
connections and cannot run inside an injected transaction handle. The tests in `@vers/jobs` own
retry and dead-letter timing. A consumer's suite asserts that a failed job survives and stays
invisible during backoff, never wall-clock redelivery.
