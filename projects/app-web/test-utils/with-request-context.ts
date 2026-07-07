import { createId } from '@paralleldrive/cuid2';
import type { FakeSession } from './request-context-holder';
import { requestContextHolder } from './request-context-holder';

export interface RequestContextInit {
  /** Seeds a named cookie session (keyed by its `SessionConfig.name`) with existing data. */
  readonly cookies?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly ip?: string;
  readonly url?: string;
}

export interface RequestContextOutcome<T> {
  /** Every named cookie session's data once the driven call finished; missing if it was cleared. */
  readonly cookies: Readonly<Record<string, Record<string, unknown> | undefined>>;
  readonly value: T;
}

/**
 * Drives an async call inside a faked `@tanstack/react-start/server` ambient request: the preload
 * installs a stub of that module's request/cookie-session reads and writes, and this util is the
 * only place a test may set what those reads see or seed a pre-existing cookie session.
 */
export async function withRequestContext<T>(
  init: Readonly<RequestContextInit>,
  run: () => Promise<T>,
): Promise<RequestContextOutcome<T>> {
  const sessions = new Map<string, FakeSession>();

  for (const [name, data] of Object.entries(init.cookies ?? {})) {
    sessions.set(name, { createdAt: Date.now(), data: { ...data }, id: createId() });
  }

  requestContextHolder.current = {
    headers: new Headers(init.headers ?? {}),
    ip: init.ip,
    sessions,
    url: new URL(init.url ?? 'http://localhost/'),
  };

  try {
    const value = await run();

    return { cookies: snapshotCookies(sessions), value };
  } finally {
    requestContextHolder.current = null;
  }
}

function snapshotCookies(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- FakeSession's data object is the fake session store's own deliberately mutable state
  sessions: ReadonlyMap<string, FakeSession>,
): Record<string, Record<string, unknown> | undefined> {
  const cookies: Record<string, Record<string, unknown> | undefined> = {};

  for (const [name, session] of sessions) {
    cookies[name] = session.data;
  }

  return cookies;
}
