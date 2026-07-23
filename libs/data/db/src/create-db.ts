import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { CamelCasePlugin, Kysely } from 'kysely';
import type { LogEvent } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import type { DB } from './schema.generated';

interface CreateDBConfig {
  readonly databaseURL: string;
  readonly searchPath?: string;
}

/**
 * Builds a `Kysely` client over the shared postgres.js dialect with
 * camelCase-mapped columns. Callers own env parsing — this never reads
 * `process.env` itself.
 *
 * Both session-level timeouts below bound how long a single statement or an
 * idle-in-transaction connection can hold a lock: no future code path that
 * opens a transaction can leave orphaned transaction state alive past 30s,
 * even across a serverless process kill.
 *
 * `idle_timeout` (seconds, unlike the millisecond session timeouts) closes a
 * pooled connection from the client side before the managed Postgres endpoint
 * suspends on its own idle timeout and drops the socket server-side. Without
 * it the pool hands a caller a connection the endpoint already closed, and the
 * first write fails with CONNECTION_CLOSED; the value stays under the
 * endpoint's suspend timeout so the client always closes first.
 */
export function createDB(config: CreateDBConfig): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresJSDialect({
      postgres: postgres(config.databaseURL, {
        connection: {
          idle_in_transaction_session_timeout: 30_000,
          statement_timeout: 30_000,
          ...(config.searchPath === undefined ? {} : { search_path: config.searchPath }),
        },
        idle_timeout: 240,
      }),
    }),
    log: recordQuerySpan,
    plugins: [new CamelCasePlugin()],
  });
}

/**
 * Emits one retroactive CLIENT span per compiled query from Kysely's `log` callback, timed from
 * `queryDurationMillis` so the span covers the statement's real duration rather than the instant
 * this callback runs. Created against `context.active()` so it parents to whatever request or
 * worker span is active; a no-op (the OpenTelemetry API's own no-op span) without a registered
 * tracer provider. Query parameters never ride in the span — only the compiled SQL, already in its
 * placeholder form (`$1`, `$2`, …).
 */
function recordQuerySpan(event: LogEvent): void {
  const endTime = new Date();

  const tracer = trace.getTracer('@vers/db');

  const span = tracer.startSpan(
    `db.${toOperationName(event.query.query.kind)}`,
    {
      attributes: { 'db.statement': event.query.sql, 'db.system': 'postgresql' },
      kind: SpanKind.CLIENT,
      startTime: new Date(endTime.getTime() - event.queryDurationMillis),
    },
    context.active(),
  );

  if (event.level === 'error') {
    const exception = event.error instanceof Error ? event.error : String(event.error);

    span.recordException(exception);
    span.setStatus({ code: SpanStatusCode.ERROR });
  }

  span.end(endTime);
}

/**
 * Derives a short span-name suffix from a compiled query's root operation-node kind
 * (`SelectQueryNode` → `select`, `CreateTableNode` → `createtable`).
 */
function toOperationName(kind: string): string {
  return kind.replace(/(?:Query)?Node$/, '').toLowerCase();
}
