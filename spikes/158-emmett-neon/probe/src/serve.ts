import { createActivityStore } from '@vers/spike-store';
import { Elysia, t } from 'elysia';
import { SQL } from 'bun';
import { runBenchScenario } from './run-bench-scenario';
import { withTiming } from './with-timing';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const store = createActivityStore(connectionString);

const app = new Elysia()
  .get('/health', () => ({ ok: true, region: process.env.FLY_REGION ?? 'local' }))

  /** Query through the store's long-lived pool — pool behaviour after a Neon suspend. */
  .get('/ping-pooled', async () => {
    try {
      const pinged = await withTiming(() => store.eventStore.streamExists('activity:ping'));
      return { ok: true, ms: Math.round(pinged.ms * 10) / 10 };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  })

  /** Full fresh connection (TCP+TLS+auth) plus SELECT 1 — the cold-start number. */
  .get('/ping-fresh', async () => {
    const pinged = await withTiming(async () => {
      const sql = new SQL(connectionString);
      await sql`select 1`;
      await sql.close();
    });
    return { ok: true, ms: Math.round(pinged.ms * 10) / 10 };
  })

  .get('/progress/:activityId', async ({ params }) => {
    const read = await withTiming(() => store.readProgress(params.activityId));
    return { ms: Math.round(read.ms * 10) / 10, progress: read.result };
  })

  .get('/replay/:activityId', async ({ params }) => {
    const replayed = await withTiming(() => store.replayActivity(params.activityId));
    return {
      ms: Math.round(replayed.ms * 10) / 10,
      streamExists: replayed.result.streamExists,
      currentStreamVersion: Number(replayed.result.currentStreamVersion),
      eventCount: replayed.result.eventCount,
      chain: replayed.result.chain,
    };
  })

  .post(
    '/bench/run',
    ({ body }) =>
      runBenchScenario(store, {
        batches: body?.batches ?? 20,
        checkpointsPerBatch: body?.checkpointsPerBatch ?? 10,
        pointReads: body?.pointReads ?? 20,
      }),
    {
      body: t.Optional(
        t.Object({
          batches: t.Optional(t.Number()),
          checkpointsPerBatch: t.Optional(t.Number()),
          pointReads: t.Optional(t.Number()),
        }),
      ),
    },
  )

  .listen(Number(process.env.PORT ?? 3002));

console.log(`spike-158 probe listening on :${app.server?.port} (region: ${process.env.FLY_REGION ?? 'local'})`);
