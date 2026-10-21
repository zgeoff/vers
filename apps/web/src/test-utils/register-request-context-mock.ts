import { afterEach, mock } from 'bun:test';
import * as reactStartServer from '@tanstack/react-start/server';
import type { RequestContextState, StubCookieOptions } from './request-context-holder';
import { requestContextHolder } from './request-context-holder';

export function registerRequestContextMock(): void {
  afterEach(() => {
    requestContextHolder.current = null;
  });

  void mock.module('@tanstack/react-start/server', () => ({
    ...reactStartServer,

    deleteCookie(name: string, options?: StubCookieOptions): void {
      requireContext().responseCookies.set(name, { options: { ...options, maxAge: 0 }, value: '' });
    },

    // mirrors Start, which reads a cookie from the request header alone and never sees one that
    // the same request set
    // oxlint-disable-next-line zgeoff/verb-contract -- stands in for the @tanstack/react-start/server export of this name
    getCookie(name: string): string | undefined {
      return requireContext().requestCookies.get(name);
    },

    getRequest(): Request {
      return requireContext().request;
    },

    // oxlint-disable-next-line zgeoff/verb-contract -- stands in for the @tanstack/react-start/server export of this name
    getRequestHeader(name: string): string | undefined {
      return requireContext().headers.get(name) ?? undefined;
    },

    getRequestHeaders(): Headers {
      return requireContext().headers;
    },

    // oxlint-disable-next-line zgeoff/verb-contract -- stands in for the @tanstack/react-start/server export of this name
    getRequestIP(): string | undefined {
      return requireContext().ip;
    },

    getRequestUrl(): URL {
      return requireContext().url;
    },

    setCookie(name: string, value: string, options?: StubCookieOptions): void {
      requireContext().responseCookies.set(name, { options, value });
    },
  }));
}

function requireContext(): RequestContextState {
  const current = requestContextHolder.current;

  if (current === null) {
    throw new Error('ambient request context read outside a withRequestContext block');
  }

  return current;
}
