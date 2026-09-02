import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { CamelCasePlugin, Kysely } from 'kysely';
import type { AbortableOperationOptions, Dialect, Driver, LogEvent } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import type { DB } from './schema.generated';

interface CreateDBConfig {
  readonly databaseURL: string;
  readonly searchPath?: string;
}

export function createDB(config: CreateDBConfig): Kysely<DB> {
  const sql = postgres(config.databaseURL, buildPostgresOptions(config));

  return new Kysely<DB>({
    dialect: buildTracedDialect(new PostgresJSDialect({ postgres: sql })),
    log: recordQuerySpan,
    plugins: [new CamelCasePlugin()],
  });
}

export function buildPostgresOptions(config: CreateDBConfig) {
  return {
    // bounds connection acquisition, which neither session timeout below covers: a suspended
    // managed Postgres endpoint that stalls on wake fails in 10s instead of hanging for minutes,
    // and 10s leaves headroom for a normal cold wake of roughly 1-5s
    connect_timeout: 10,
    connection: {
      // both session timeouts cap how long a statement or an idle-in-transaction connection holds
      // a lock, so orphaned transaction state dies within 30s even after a serverless process kill
      idle_in_transaction_session_timeout: 30_000,
      statement_timeout: 30_000,
      ...(config.searchPath === undefined ? {} : { search_path: config.searchPath }),
    },

    // seconds, unlike the millisecond session timeouts above. Stays under the managed endpoint's
    // suspend timeout so the client closes a pooled connection first; otherwise the pool hands
    // out a socket the endpoint already closed and the first write fails with CONNECTION_CLOSED
    idle_timeout: 240,
  };
}

function buildTracedDialect(dialect: PostgresJSDialect): Dialect {
  return {
    createAdapter: () => dialect.createAdapter(),
    createDriver: () => buildTracedDriver(dialect.createDriver()),
    createIntrospector: (db) => dialect.createIntrospector(db),
    createQueryCompiler: () => dialect.createQueryCompiler(),
  };
}

function buildTracedDriver(driver: Driver): Driver {
  // a Proxy rather than a hand-listed method map: the dialect's driver interface carries optional
  // savepoint methods, and one left out of a list would read as unsupported instead of reaching the
  // inner driver
  return new Proxy(driver, {
    get: (target, property, receiver) => {
      if (property === 'acquireConnection') {
        return (options?: AbortableOperationOptions) =>
          withConnectSpan(() => target.acquireConnection(options));
      }

      const value: unknown = Reflect.get(target, property, receiver);

      if (typeof value !== 'function') {
        return value;
      }

      const boundValue: unknown = value.bind(target);

      return boundValue;
    },
  });
}

async function withConnectSpan<T>(acquireConnection: () => Promise<T>): Promise<T> {
  const tracer = trace.getTracer('@vers/db');

  const span = tracer.startSpan(
    'db.connect',
    { attributes: { 'db.system': 'postgresql' }, kind: SpanKind.CLIENT },
    context.active(),
  );

  try {
    return await acquireConnection();
  } catch (error) {
    const exception = error instanceof Error ? error : String(error);

    span.recordException(exception);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

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

function toOperationName(kind: string): string {
  return kind.replace(/(?:Query)?Node$/, '').toLowerCase();
}
