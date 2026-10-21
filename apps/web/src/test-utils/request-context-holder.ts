import type { setCookie } from '@tanstack/react-start/server';

export type StubCookieOptions = Parameters<typeof setCookie>[2];

export interface StubCookie {
  readonly options: StubCookieOptions;
  readonly value: string;
}

export interface RequestContextState {
  readonly headers: Headers;
  readonly ip: string | undefined;
  readonly request: Request;
  readonly requestCookies: ReadonlyMap<string, string>;
  readonly responseCookies: Map<string, StubCookie>;
  readonly url: URL;
}

export const requestContextHolder: { current: RequestContextState | null } = { current: null };
