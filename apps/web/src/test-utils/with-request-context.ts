import { createId } from '@paralleldrive/cuid2';
import { runWithStartContext } from '@tanstack/start-storage-context';
import type { FakeSession } from './request-context-holder';
import { requestContextHolder } from './request-context-holder';

interface RequestContextInit {
  /**
   * Seeds a named cookie session (keyed by its `SessionConfig.name`) with existing data.
   */
  readonly cookies?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly ip?: string;
  readonly url?: string;
}

interface RequestContextOutcome<T> {
  /**
   * Every named cookie session's data once the driven call finished; missing if it was cleared.
   */
  readonly cookies: Readonly<Record<string, Record<string, unknown> | undefined>>;
  readonly value: T;
}

/**
 * Drives an async call inside a faked `@tanstack/react-start/server` ambient request: the preload
 * installs a stub of that module's request/cookie-session reads and writes, and this util is the
 * only place a test may set what those reads see or seed a pre-existing cookie session. Also
 * establishes the Start framework's own request-scoped `AsyncLocalStorage` context, so a real
 * `createServerFn`-wrapped export (not just its handler body) can dispatch under `bun test`, which
 * never runs the compiler pass that would otherwise supply it.
 *
 * That uncompiled dispatch relays only a `Response` or a thrown redirect/error back to the caller —
 * a handler's plain result object resolves as `undefined`. Component tests therefore cover the
 * branches that round-trip that way; plain-object branches are asserted at the handler layer, and
 * the real compiled pipeline is the smoke suite's to cover.
 */
export async function withRequestContext<T>(
  init: Readonly<RequestContextInit>,
  run: () => Promise<T>,
): Promise<RequestContextOutcome<T>> {
  const sessions = new Map<string, FakeSession>();

  for (const [name, data] of Object.entries(init.cookies ?? {})) {
    sessions.set(name, { createdAt: Date.now(), data: { ...data }, id: createId() });
  }

  const request = new Request(init.url ?? 'http://localhost/');

  requestContextHolder.current = {
    headers: new Headers(init.headers ?? {}),
    ip: init.ip,
    request,
    sessions,
    url: new URL(init.url ?? 'http://localhost/'),
  };

  try {
    const value = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        executedRequestMiddlewares: new Set(),
        getRouter: () => {
          throw new Error('getRouter is not available under withRequestContext');
        },
        handlerType: 'serverFn',
        request,
        startOptions: {},
      },
      run,
    );

    return { cookies: toCookieSnapshot(sessions), value };
  } finally {
    requestContextHolder.current = null;
  }
}

function toCookieSnapshot(
  sessions: ReadonlyMap<string, FakeSession>,
): Record<string, Record<string, unknown> | undefined> {
  const cookies: Record<string, Record<string, unknown> | undefined> = {};

  for (const [name, session] of sessions) {
    cookies[name] = session.data;
  }

  return cookies;
}
