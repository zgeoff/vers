/**
 * Spike for #441: proves pg-boss works under bun (and compiled to a binary), and that the
 * fromKysely adapter makes enqueue transactional — commit enqueues, rollback doesn't.
 * Run against the repo's pg test container (bun run pg:test-container:start).
 */
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { PgBoss, fromKysely } from 'pg-boss';

const HOST_URI = 'postgres://test:test@localhost:32999';
const SPIKE_DB = 'spike441';
const QUEUE = 'email';

interface SpikeDB {
  orders: { item: string };
}

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }

  console.log(`PASS: ${label}`);
}

// fresh database per run so the spike is rerunnable
{
  const admin = new pg.Client({ connectionString: `${HOST_URI}/postgres` });

  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SPIKE_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${SPIKE_DB}`);
  await admin.end();
}

const boss = new PgBoss(`${HOST_URI}/${SPIKE_DB}`);

boss.on('error', (error) => {
  console.error('boss error', error);
});

await boss.start();
await boss.createQueue(QUEUE);

console.log('PASS: pg-boss started + migrated schema');

const db = new Kysely<SpikeDB>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: `${HOST_URI}/${SPIKE_DB}` }),
  }),
});

await db.schema
  .createTable('orders')
  .addColumn('item', 'text', (col) => col.notNull())
  .execute();

// 1. transactional enqueue: commit path
await db.transaction().execute(async (trx) => {
  await trx.insertInto('orders').values({ item: 'widget' }).execute();
  await boss.send(QUEUE, { to: 'a@example.com' }, { db: fromKysely(trx) });
});

let queued = await boss.findJobs(QUEUE, { queued: true });

assert(queued.length === 1, 'committed transaction enqueued the job');

// 2. transactional enqueue: rollback path
await db
  .transaction()
  .execute(async (trx) => {
    await trx.insertInto('orders').values({ item: 'doomed' }).execute();
    await boss.send(QUEUE, { to: 'b@example.com' }, { db: fromKysely(trx) });

    throw new Error('rollback');
  })
  .catch((error: unknown) => {
    if (!(error instanceof Error) || error.message !== 'rollback') throw error;
  });

queued = await boss.findJobs(QUEUE, { queued: true });

assert(queued.length === 1, 'rolled-back transaction did not enqueue');

// 3. one-shot drain: fetch until empty (the boot-drain / sweeper pattern)
let drained = 0;

for (;;) {
  const jobs = await boss.fetch(QUEUE, { batchSize: 10 });

  if (jobs.length === 0) break;

  for (const job of jobs) {
    await boss.complete(QUEUE, job.id);

    drained += 1;
  }
}

assert(drained === 1, 'one-shot drain fetched and completed the backlog');

queued = await boss.findJobs(QUEUE, { queued: true });

assert(queued.length === 0, 'queue empty after drain');

// 4. retry scheduling: a failed job becomes invisible until its retry delay elapses,
// then a later drain (the sweeper) picks it up
await boss.send(QUEUE, { to: 'retry@example.com' }, { retryLimit: 2, retryDelay: 2 });

const [failing] = await boss.fetch(QUEUE);

assert(failing !== undefined, 'retry job fetched');

await boss.fail(QUEUE, failing!.id);

const early = await boss.fetch(QUEUE);

assert(early.length === 0, 'failed job not visible before retry delay');

await new Promise((resolve) => setTimeout(resolve, 2500));

const [retried] = await boss.fetch(QUEUE);

assert(retried !== undefined, 'sweeper-style fetch picks up the retry after its delay');

await boss.complete(QUEUE, retried!.id);
await boss.stop({ close: true });
await db.destroy();

console.log('SPIKE OK');
process.exit(0);
