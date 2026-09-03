import { createId } from '@paralleldrive/cuid2';
import { runWithStartContext } from '@tanstack/start-storage-context';
import type { StubSession } from './request-context-holder';
import { requestContextHolder } from './request-context-holder';

interface RequestContextInit {
  readonly cookies?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly ip?: string;
  readonly url?: string;
}

interface RequestContextOutcome<T> {
  readonly cookies: Readonly<Record<string, Record<string, unknown> | undefined>>;
  readonly value: T;
}

export async function withRequestContext<T>(
  init: Readonly<RequestContextInit>,
  run: () => Promise<T> | T,
): Promise<RequestContextOutcome<T>> {
  const sessions = new Map<string, StubSession>();

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
}

function toCookieSnapshot(
  sessions: ReadonlyMap<string, StubSession>,
): Record<string, Record<string, unknown> | undefined> {
  const cookies: Record<string, Record<string, unknown> | undefined> = {};

  for (const [name, session] of sessions) {
    cookies[name] = session.data;
  }

  return cookies;
}
