import { mock } from 'bun:test';
import * as reactStartServer from '@tanstack/react-start/server';
import type { MockSession, RequestContextState } from './request-context-holder';
import { requestContextHolder } from './request-context-holder';

/**
 * Installs the sanctioned ambient-context stub for `@tanstack/react-start/server`'s request and
 * cookie-session reads, called once from the test preload. Every other export of the real module
 * passes through unchanged; a call to a mocked export outside a `withRequestContext` block throws,
 * the same way the real module throws outside a live request.
 */
export function registerRequestContextMock(): void {
  void mock.module('@tanstack/react-start/server', () => ({
    ...reactStartServer,
    clearSession: mockClearSession,
    getRequest: mockGetRequest,
    getRequestHeader: mockGetRequestHeader,
    getRequestHeaders: mockGetRequestHeaders,
    getRequestIP: mockGetRequestIP,
    getRequestUrl: mockGetRequestUrl,
    getSession: mockGetSession,
    updateSession: mockUpdateSession,
  }));
}

function requireContext(): RequestContextState {
  const current = requestContextHolder.current;

  if (current === null) {
    throw new Error('ambient request context read outside a withRequestContext block');
  }

  return current;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the mock session store's Map is deliberately mutable; that mutability is the point of this test double
function findOrCreateSession(state: RequestContextState, name: string): MockSession {
  const existing = state.sessions.get(name);

  if (existing !== undefined) {
    return existing;
  }

  const created: MockSession = { createdAt: Date.now(), data: {}, id: crypto.randomUUID() };

  state.sessions.set(name, created);

  return created;
}

interface MockSessionConfig {
  readonly name?: string;
}

type MockSessionUpdate =
  | Readonly<Record<string, unknown>>
  | ((data: Readonly<Record<string, unknown>>) => Record<string, unknown> | undefined);

function mockGetSession(config: MockSessionConfig): Promise<MockSession> {
  const state = requireContext();

  return Promise.resolve(findOrCreateSession(state, config.name ?? 'h3'));
}

function mockUpdateSession(
  config: MockSessionConfig,
  update?: MockSessionUpdate,
): Promise<MockSession> {
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
}

function mockClearSession(config: MockSessionConfig): Promise<void> {
  const state = requireContext();

  state.sessions.delete(config.name ?? 'h3');

  return Promise.resolve();
}

function mockGetRequest(): Request {
  return requireContext().request;
}

function mockGetRequestUrl(): URL {
  return requireContext().url;
}

function mockGetRequestIP(): string | undefined {
  return requireContext().ip;
}

function mockGetRequestHeaders(): Headers {
  return requireContext().headers;
}

function mockGetRequestHeader(name: string): string | undefined {
  return requireContext().headers.get(name) ?? undefined;
}
