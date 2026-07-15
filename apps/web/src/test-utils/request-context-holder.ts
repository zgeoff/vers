/**
 * One mocked cookie session: mirrors the shape `@tanstack/react-start/server` itself returns.
 */
export interface StubSession {
  createdAt: number;
  data: Record<string, unknown>;
  id: string;
}

/**
 * The ambient request state a `withRequestContext` call is currently driving.
 */
export interface RequestContextState {
  readonly headers: Headers;
  readonly ip: string | undefined;
  readonly request: Request;
  readonly sessions: Map<string, StubSession>;
  readonly url: URL;
}

/**
 * The one mutable slot the preload's `@tanstack/react-start/server` mock and `withRequestContext`
 * coordinate through: `null` outside any `withRequestContext` call, so a stray ambient read outside
 * a test's driven block fails loudly instead of silently reading stale state.
 */
export const requestContextHolder: { current: RequestContextState | null } = { current: null };
