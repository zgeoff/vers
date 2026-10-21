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

  for (const [name, seal] of collectJoinedSeals(sealed)) {
    const data = await unsealData<unknown>(seal, { password: readSessionSecret() });

    cookies[name] = cookieDataSchema.parse(data);
  }

  return cookies;
}

// iron-session splits a seal too large for one cookie into `<name>.0`, `<name>.1` and so on, and
// reads them back joined in index order
const CHUNK_NAME_PATTERN = /^(?<name>.+)\.(?<index>\d+)$/u;

function collectJoinedSeals(sealed: ReadonlyMap<string, string>): Map<string, string> {
  const joined = new Map<string, string>();
  const chunks = new Map<string, Array<{ readonly index: number; readonly value: string }>>();

  for (const [cookieName, value] of sealed) {
    const groups = CHUNK_NAME_PATTERN.exec(cookieName)?.groups;

    if (groups?.['name'] === undefined || groups['index'] === undefined) {
      joined.set(cookieName, value);
    } else {
      const parts = chunks.get(groups['name']) ?? [];

      parts.push({ index: Number(groups['index']), value });
      chunks.set(groups['name'], parts);
    }
  }

  for (const [name, parts] of chunks) {
    parts.sort((left, right) => left.index - right.index);
    joined.set(name, parts.map((part) => part.value).join(''));
  }

  return joined;
}
