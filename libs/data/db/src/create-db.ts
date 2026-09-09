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
import type { PoolResetReason } from './types';

export interface CreateDBConfig {
  readonly databaseURL: string;
  readonly idleInTransactionSessionTimeoutMs?: number;
  readonly queryDeadlineMs?: number;
  readonly resumeDetection?: Omit<StartResumeDetectorConfig, 'onResume'>;
  readonly searchPath?: string;
}

const DEFAULT_SESSION_TIMEOUT_MS = 30_000;

// statement_timeout makes a live server answer within 30s, so 5s more of silence means the
// transport is dead, not the statement slow
const DEFAULT_QUERY_DEADLINE_MS = DEFAULT_SESSION_TIMEOUT_MS + 5000;

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
      // a lock, so orphaned transaction state dies after a serverless process kill: within 30s for
      // a statement, and within the configured idle bound (30s unless the caller lengthens it)
      idle_in_transaction_session_timeout:
        config.idleInTransactionSessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
      statement_timeout: DEFAULT_SESSION_TIMEOUT_MS,
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

interface ConnectionLease {
  readonly generation: PoolGeneration;
  readonly inner: DatabaseConnection;
}

function buildResettableDriver(config: CreateDBConfig): Driver {
  const leases = new WeakMap<DatabaseConnection, ConnectionLease>();

  const queryDeadlineMs = config.queryDeadlineMs ?? DEFAULT_QUERY_DEADLINE_MS;
  let current = createPoolGeneration(config);
  let detector: ResumeDetector | null = null;

  const resolveLease = (connection: DatabaseConnection): ConnectionLease => {
    const lease = leases.get(connection);

    invariant(lease, 'every connection handed back to the driver was leased by acquireConnection');

    return lease;
  };

  const resolveDriver = (connection: DatabaseConnection): Driver =>
    resolveLease(connection).generation.driver;

  const resetPool = async (reason: PoolResetReason): Promise<void> => {
    const previous = current;

    current = createPoolGeneration(config);
    previous.ended = true;

    recordPoolReset(reason);

    // a zero timeout destroys the sockets and rejects every query still pending on them; the
    // graceful end would wait on a peer that closed during the pause or stopped answering
    await previous.sql.end({ timeout: 0 });
  };

  return {
    acquireConnection: async (options) => {
      // the first request after a resume lands before the detector's next tick, so the gap check
      // runs here too and the reset swaps the generation before a connection is handed out
      detector?.check();
      const generation = current;

      await generation.ready;

      const inner = await generation.driver.acquireConnection(options);

      const connection = buildBoundedConnection(inner, queryDeadlineMs, () => {
        // a generation already replaced by a resume or an earlier stall has had its sockets
        // destroyed, which rejected this query too
        if (generation === current) {
          void resetPool('query_stall');
        }
      });

      leases.set(connection, { generation, inner });

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
          void resetPool('resume');
        },
      });
    },
    releaseConnection: async (connection, options) => {
      const lease = resolveLease(connection);

      if (lease.generation.ended) {
        return;
      }

      await lease.generation.driver.releaseConnection(lease.inner, options);
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

function buildBoundedConnection(
  inner: DatabaseConnection,
  deadlineMs: number,
  onDeadline: () => void,
): DatabaseConnection {
  return {
    executeQuery: (compiledQuery) =>
      withDeadline(() => inner.executeQuery(compiledQuery), deadlineMs, onDeadline),
    streamQuery: (compiledQuery, chunkSize, options) =>
      withChunkDeadline(
        () => inner.streamQuery(compiledQuery, chunkSize, options),
        deadlineMs,
        onDeadline,
      ),
  };
}

async function* withChunkDeadline<T>(
  open: () => AsyncIterableIterator<T>,
  deadlineMs: number,
  onDeadline: () => void,
): AsyncIterableIterator<T> {
  const iterator = open()[Symbol.asyncIterator]();

  try {
    for (;;) {
      // the deadline runs only while a chunk is awaited from the driver, never across the
      // consumer's own work between chunks
      const step = await withDeadline(() => iterator.next(), deadlineMs, onDeadline);

      if (step.done === true) {
        return;
      }

      yield step.value;
    }
  } finally {
    await iterator.return?.();
  }
}

async function withDeadline<T>(
  run: () => Promise<T>,
  deadlineMs: number,
  onDeadline: () => void,
): Promise<T> {
  // Kysely's abort signal alone would strand the connection: kysely-postgres-js implements
  // neither cancelQuery nor killSession, so the reserved socket stays out of the pool until the
  // kernel gives up on it. Dropping the whole pool generation is the only way to free it.
  const timer = setTimeout(onDeadline, deadlineMs);

  try {
    return await run();
  } finally {
    clearTimeout(timer);
  }
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
