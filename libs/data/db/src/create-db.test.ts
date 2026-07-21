import { expect, onTestFinished, test } from 'bun:test';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import invariant from 'tiny-invariant';
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

  const [span] = ctx.exporter.getFinishedSpans();

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

  const [span] = ctx.exporter.getFinishedSpans();

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

  const [span] = ctx.exporter.getFinishedSpans();

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

  const [querySpan, parentSpan] = ctx.exporter.getFinishedSpans();

  invariant(querySpan, 'expected the query span to be exported');
  invariant(parentSpan, 'expected the parent span to be exported');

  expect(querySpan.parentSpanContext?.spanId).toBe(parentSpan.spanContext().spanId);
});

test('it stays inert without a registered tracer provider', async () => {
  await using handle = await createTestDB();

  await expect(handle.db.selectFrom('users').selectAll().execute()).toResolve();
});
