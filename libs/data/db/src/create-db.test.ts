import { expect, onTestFinished, test } from 'bun:test';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { waitFor } from '@vers/test-utils';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { sql } from 'kysely';
import invariant from 'tiny-invariant';
import { buildPostgresOptions, createDB } from './create-db';
import { createTestDB } from './test-support/create-test-db';

function setupTest() {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

  provider.register();

  onTestFinished(async () => {
    trace.disable();

    await provider.shutdown();
  });

  return { exporter };
}

test('it round-trips a row through camelCase-mapped columns', async () => {
  await using handle = await createTestDB();

  const db = handle.db;

  const inserted = await db
    .insertInto('users')
    .values({
      email: 'create-db@test.com',
      id: 'usr_create_db_test',
      name: 'Create DB Test User',
      username: 'create_db_test_user',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(inserted.createdAt).toBeInstanceOf(Date);
  expect(inserted.passwordHash).toBeNull();

  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', 'create-db@test.com')
    .executeTakeFirstOrThrow();

  expect(user.id).toBe('usr_create_db_test');
  expect(user.username).toBe('create_db_test_user');
  expect(user.createdAt).toBeInstanceOf(Date);
});

test('it emits a db.select client span carrying the compiled sql with placeholders in place of bind values', async () => {
  const ctx = setupTest();

  await using handle = await createTestDB();

  await handle.db.selectFrom('users').selectAll().where('email', '=', 'redaction-probe').execute();

  const span = ctx.exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.select');

  invariant(span, 'expected the query span to be exported');

  expect(span.name).toBe('db.select');
  expect(span.kind).toBe(SpanKind.CLIENT);
  expect(span.attributes['db.system']).toBe('postgresql');
  expect(span.attributes['db.statement']).toInclude('select');
  expect(span.attributes['db.statement']).toInclude('$1');
  expect(span.attributes['db.statement']).not.toInclude('redaction-probe');
});

test('it names the span from the compiled query kind', async () => {
  const ctx = setupTest();

  await using handle = await createTestDB();

  await handle.db
    .insertInto('users')
    .values({
      email: 'span-name@test.com',
      id: 'usr_span_name_test',
      name: 'Span Name Test User',
      username: 'span_name_test_user',
    })
    .execute();

  const span = ctx.exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.insert');

  expect(span?.name).toBe('db.insert');
});

test('it marks the span failed for a query that errors', async () => {
  const ctx = setupTest();

  await using handle = await createTestDB();

  await expect(
    handle.db
      .selectFrom('users')
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberately invalid column name, exercised for its error path
      .select('not_a_real_column' as 'id')
      .execute(),
  ).toReject();

  const span = ctx.exporter.getFinishedSpans().find((candidate) => candidate.name === 'db.select');

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});

test('it parents the query span to the active context', async () => {
  const ctx = setupTest();

  await using handle = await createTestDB();

  const tracer = trace.getTracer('test');

  await tracer.startActiveSpan('parent', async (parentSpan) => {
    await handle.db.selectFrom('users').selectAll().execute();

    parentSpan.end();
  });

  const spans = ctx.exporter.getFinishedSpans();
  const querySpan = spans.find((candidate) => candidate.name === 'db.select');
  const parentSpan = spans.find((candidate) => candidate.name === 'parent');

  invariant(querySpan, 'expected the query span to be exported');
  invariant(parentSpan, 'expected the parent span to be exported');

  expect(querySpan.parentSpanContext?.spanId).toBe(parentSpan.spanContext().spanId);
});

test('it stays inert without a registered tracer provider', async () => {
  await using handle = await createTestDB();

  await expect(handle.db.selectFrom('users').selectAll().execute()).toResolve();
});

test('it bounds connection acquisition with a 10s connect_timeout', () => {
  const options = buildPostgresOptions({ databaseURL: 'postgres://user:pass@localhost:5432/db' });

  expect(options.connect_timeout).toBe(10);
});

test('it emits a db.connect client span around a successful connection acquisition', async () => {
  const ctx = setupTest();

  await using handle = await createTestDB();

  await handle.db.selectFrom('users').selectAll().execute();

  const connectSpans = ctx.exporter.getFinishedSpans().filter((span) => span.name === 'db.connect');

  expect(connectSpans).toHaveLength(1);
  expect(connectSpans[0]?.kind).toBe(SpanKind.CLIENT);
  expect(connectSpans[0]?.attributes['db.system']).toBe('postgresql');
});

test('it forwards savepoint, rollbackToSavepoint, and releaseSavepoint to the wrapped driver', async () => {
  await using handle = await createTestDB();

  const trx = await handle.db.startTransaction().execute();

  try {
    await trx
      .insertInto('users')
      .values({
        email: 'before-savepoint@test.com',
        id: 'usr_before_savepoint',
        name: 'Before Savepoint User',
        username: 'before_savepoint_user',
      })
      .execute();

    const trxAfterSavepoint = await trx.savepoint('after_insert').execute();

    await trxAfterSavepoint
      .insertInto('users')
      .values({
        email: 'after-savepoint@test.com',
        id: 'usr_after_savepoint',
        name: 'After Savepoint User',
        username: 'after_savepoint_user',
      })
      .execute();

    const trxAfterRollback = await trxAfterSavepoint.rollbackToSavepoint('after_insert').execute();

    await trxAfterRollback.releaseSavepoint('after_insert').execute();
    await trxAfterRollback.commit().execute();
  } catch (error) {
    await trx.rollback().execute();

    throw error;
  }

  const users = await handle.db
    .selectFrom('users')
    .select('id')
    .where('id', 'in', ['usr_before_savepoint', 'usr_after_savepoint'])
    .execute();

  expect(users.map((user) => user.id)).toStrictEqual(['usr_before_savepoint']);
});

test('it marks the db.connect span failed and records the exception when the connection never opens', async () => {
  const ctx = setupTest();
  const db = createDB({ databaseURL: 'postgres://user:pass@127.0.0.1:1/db' });

  onTestFinished(() => db.destroy());

  await expect(db.selectFrom('users').selectAll().execute()).toReject();

  const connectSpan = ctx.exporter.getFinishedSpans().find((span) => span.name === 'db.connect');

  invariant(connectSpan, 'expected a db.connect span to be exported');

  expect(connectSpan.status.code).toBe(SpanStatusCode.ERROR);
  expect(connectSpan.events[0]?.name).toBe('exception');
});

test('it serves the next query from a fresh connection after the wall clock jumps past the resume threshold', async () => {
  const inMemoryMetrics = createInMemoryMetrics();
  let clock = Date.now();

  await using handle = await createTestDB({
    resumeDetection: { intervalMs: 10, now: () => clock, thresholdMs: 1000 },
  });

  const before = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(handle.db);

  clock += 600_000;

  await waitFor(async () => {
    const resets = await inMemoryMetrics.readCounterValue('vers.db.pool_resets');

    expect(resets).toBe(1);
  });

  const after = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(handle.db);

  const [beforeRow] = before.rows;
  const [afterRow] = after.rows;

  invariant(beforeRow && afterRow, 'expected one row per query');

  expect(afterRow.pid).not.toBe(beforeRow.pid);
});

test('it rejects a query still in flight on the old pool when a resume is detected', async () => {
  let clock = Date.now();

  await using handle = await createTestDB({
    resumeDetection: { intervalMs: 10, now: () => clock, thresholdMs: 1000 },
  });

  await handle.db.selectFrom('users').selectAll().execute();

  const sleeping = sql`select pg_sleep(20)`.execute(handle.db);

  await waitFor(async () => {
    const active = await sql<{ count: number }>`
      select count(*)::int as count from pg_stat_activity
      where state = 'active' and query like '%pg_sleep(20)%' and pid <> pg_backend_pid()
    `.execute(handle.db);

    expect(active.rows[0]?.count).toBe(1);
  });

  clock += 600_000;

  await sleeping.catch(() => {});

  expect(sleeping).rejects.toMatchObject({ code: 'CONNECTION_DESTROYED' });

  await expect(handle.db.selectFrom('users').selectAll().execute()).toResolve();
});

test('it serves the first query after a wall-clock jump from a fresh connection before the detector ticks', async () => {
  const inMemoryMetrics = createInMemoryMetrics();
  let clock = Date.now();

  // a 60s interval keeps the timer from ticking during the test, so only the acquire-time check
  // can reset the pool
  await using handle = await createTestDB({
    resumeDetection: { intervalMs: 60_000, now: () => clock, thresholdMs: 1000 },
  });

  const before = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(handle.db);

  clock += 61_000;

  const after = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(handle.db);

  const [beforeRow] = before.rows;
  const [afterRow] = after.rows;

  invariant(beforeRow && afterRow, 'expected one row per query');

  expect(afterRow.pid).not.toBe(beforeRow.pid);
  expect(inMemoryMetrics.readCounterValue('vers.db.pool_resets')).resolves.toBe(1);
});
