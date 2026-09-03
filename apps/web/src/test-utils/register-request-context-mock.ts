import { afterEach, mock } from 'bun:test';
import * as reactStartServer from '@tanstack/react-start/server';
import type { RequestContextState, StubSession } from './request-context-holder';
import { requestContextHolder } from './request-context-holder';

interface StubSessionConfig {
  readonly name?: string;
}

type StubSessionUpdate =
  | Readonly<Record<string, unknown>>
  | ((data: Readonly<Record<string, unknown>>) => Record<string, unknown> | undefined);

export function registerRequestContextMock(): void {
  afterEach(() => {
    requestContextHolder.current = null;
  });

  void mock.module('@tanstack/react-start/server', () => ({
    ...reactStartServer,

    clearSession(config: StubSessionConfig): Promise<void> {
      const state = requireContext();

      state.sessions.delete(config.name ?? 'h3');

      return Promise.resolve();
    },

    getRequest(): Request {
      return requireContext().request;
    },

    getRequestHeader(name: string): string | undefined {
      return requireContext().headers.get(name) ?? undefined;
    },

    getRequestHeaders(): Headers {
      return requireContext().headers;
    },

    getRequestIP(): string | undefined {
      return requireContext().ip;
    },

    getRequestUrl(): URL {
      return requireContext().url;
    },

    getSession(config: StubSessionConfig): Promise<StubSession> {
      const state = requireContext();

      return Promise.resolve(findOrCreateSession(state, config.name ?? 'h3'));
    },

    updateSession(config: StubSessionConfig, update?: StubSessionUpdate): Promise<StubSession> {
      const state = requireContext();
      const session = findOrCreateSession(state, config.name ?? 'h3');
      const partial = typeof update === 'function' ? update(session.data) : update;

      if (partial !== undefined) {
        // mirrors the real module's seal/unseal round-trip, which serializes through JSON and so
        // drops any key an update set to `undefined` rather than keeping it as an empty value
        Object.assign(session.data, partial);

        for (const [key, value] of Object.entries(partial)) {
          if (value === undefined) {
            delete session.data[key];
          }
        }
      }

      return Promise.resolve(session);
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the stub session store's Map is deliberately mutable; that mutability is the point of this test double
function findOrCreateSession(state: RequestContextState, name: string): StubSession {
  const existing = state.sessions.get(name);

  if (existing !== undefined) {
    return existing;
  }

  const created: StubSession = { createdAt: Date.now(), data: {}, id: crypto.randomUUID() };

  state.sessions.set(name, created);

  return created;
}
