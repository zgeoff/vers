import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import {
  CamelCasePlugin,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import type {
  AbortableOperationOptions,
  DatabaseConnection,
  Dialect,
  Driver,
  LogEvent,
} from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import invariant from 'tiny-invariant';
import { recordPoolReset } from './record-pool-reset';
import type { DB } from './schema.generated';
import { startResumeDetector } from './start-resume-detector';
import type { ResumeDetector, StartResumeDetectorConfig } from './start-resume-detector';

export interface CreateDBConfig {
  readonly databaseURL: string;
  readonly resumeDetection?: Omit<StartResumeDetectorConfig, 'onResume'>;
  readonly searchPath?: string;
}

export function createDB(config: CreateDBConfig): Kysely<DB> {
  return new Kysely<DB>({
    dialect: buildDialect(config),
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

function buildDialect(config: CreateDBConfig): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => buildTracedDriver(buildResettableDriver(config)),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  };
}

interface PoolGeneration {
  readonly driver: Driver;
  ended: boolean;
  readonly ready: Promise<void>;
  readonly sql: postgres.Sql;
}

function buildResettableDriver(config: CreateDBConfig): Driver {
  const owners = new WeakMap<DatabaseConnection, PoolGeneration>();

  let current = createPoolGeneration(config);
  let detector: ResumeDetector | null = null;

  const resolveDriver = (connection: DatabaseConnection): Driver =>
    (owners.get(connection) ?? current).driver;

  const resetPool = async (): Promise<void> => {
    const previous = current;

    current = createPoolGeneration(config);
    previous.ended = true;

    recordPoolReset();

    // a zero timeout destroys the sockets and rejects every query still pending on them; the
    // graceful end would wait on a peer that closed during the pause
    await previous.sql.end({ timeout: 0 });
  };

  return {
    acquireConnection: async (options) => {
      // the first request after a resume lands before the detector's next tick, so the gap check
      // runs here too and the reset swaps the generation before a connection is handed out
      detector?.check();
      const generation = current;

      await generation.ready;

      const connection = await generation.driver.acquireConnection(options);

      owners.set(connection, generation);

      return connection;
    },
    beginTransaction: (connection, settings) =>
      resolveDriver(connection).beginTransaction(connection, settings),
    commitTransaction: (connection) => resolveDriver(connection).commitTransaction(connection),
    destroy: async (options) => {
      detector?.stop();

      await current.ready;

      await current.driver.destroy(options);
    },
    init: async () => {
      await current.ready;

      detector = startResumeDetector({
        ...config.resumeDetection,
        onResume: () => {
          void resetPool();
        },
      });
    },
    releaseConnection: async (connection, options) => {
      const generation = owners.get(connection) ?? current;

      if (generation.ended) {
        return;
      }

      await generation.driver.releaseConnection(connection, options);
    },
    releaseSavepoint: (connection, savepointName, compileQuery) => {
      const driver = resolveDriver(connection);

      invariant(
        typeof driver.releaseSavepoint === 'function',
        'the postgres driver implements savepoints',
      );

      return driver.releaseSavepoint(connection, savepointName, compileQuery);
    },
    rollbackToSavepoint: (connection, savepointName, compileQuery) => {
      const driver = resolveDriver(connection);

      invariant(
        typeof driver.rollbackToSavepoint === 'function',
        'the postgres driver implements savepoints',
      );

      return driver.rollbackToSavepoint(connection, savepointName, compileQuery);
    },
    rollbackTransaction: (connection) => resolveDriver(connection).rollbackTransaction(connection),
    savepoint: (connection, savepointName, compileQuery) => {
      const driver = resolveDriver(connection);

      invariant(
        typeof driver.savepoint === 'function',
        'the postgres driver implements savepoints',
      );

      return driver.savepoint(connection, savepointName, compileQuery);
    },
  };
}

function createPoolGeneration(config: CreateDBConfig): PoolGeneration {
  const sql = postgres(config.databaseURL, buildPostgresOptions(config));

  const driver = new PostgresJSDialect({ postgres: sql }).createDriver();

  return { driver, ended: false, ready: driver.init(), sql };
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
