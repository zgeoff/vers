import { runWithStartContext } from '@tanstack/start-storage-context';
import { sealData, unsealData } from 'iron-session';
import { z } from 'zod';
import { AUTH_SESSION_DEFAULT_TTL_SECONDS } from '../lib/auth/read-auth-session-config';
import { readSessionSecret } from '../lib/auth/read-session-secret';
import type { StubCookie } from './request-context-holder';
import { requestContextHolder } from './request-context-holder';

interface RequestContextInit {
  readonly cookies?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly ip?: string;
  readonly url?: string;
}

interface RequestContextOutcome<T> {
  readonly cookies: Readonly<Record<string, Record<string, unknown> | undefined>>;
  readonly setCookies: ReadonlyMap<string, StubCookie>;
  readonly value: T;
}

export async function withRequestContext<T>(
  init: Readonly<RequestContextInit>,
  run: () => Promise<T> | T,
): Promise<RequestContextOutcome<T>> {
  const requestCookies = new Map<string, string>();

  for (const [name, data] of Object.entries(init.cookies ?? {})) {
    const sealed = await sealData(data, {
      password: readSessionSecret(),
      ttl: AUTH_SESSION_DEFAULT_TTL_SECONDS,
    });

    requestCookies.set(name, sealed);
  }

  const responseCookies = new Map<string, StubCookie>();
  const request = new Request(init.url ?? 'http://localhost/');

  requestContextHolder.current = {
    headers: new Headers(init.headers ?? {}),
    ip: init.ip,
    request,
    requestCookies,
    responseCookies,
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

  return {
    cookies: await readCookieSnapshot(requestCookies, responseCookies),
    setCookies: responseCookies,
    value,
  };
}

const cookieDataSchema = z.record(z.string(), z.unknown());

async function readCookieSnapshot(
  requestCookies: ReadonlyMap<string, string>,
  responseCookies: ReadonlyMap<string, StubCookie>,
): Promise<Record<string, Record<string, unknown> | undefined>> {
  const sealed = new Map(requestCookies);

  for (const [name, cookie] of responseCookies) {
    if (cookie.options?.maxAge === 0) {
      sealed.delete(name);
    } else {
      sealed.set(name, cookie.value);
    }
  }

  const cookies: Record<string, Record<string, unknown> | undefined> = {};

  for (const [name, seal] of sealed) {
    const data = await unsealData<unknown>(seal, { password: readSessionSecret() });

    cookies[name] = cookieDataSchema.parse(data);
  }

  return cookies;
}
