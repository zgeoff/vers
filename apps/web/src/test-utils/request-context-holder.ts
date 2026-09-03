export interface StubSession {
  createdAt: number;
  data: Record<string, unknown>;
  id: string;
}

export interface RequestContextState {
  readonly headers: Headers;
  readonly ip: string | undefined;
  readonly request: Request;
  readonly sessions: Map<string, StubSession>;
  readonly url: URL;
}

export const requestContextHolder: { current: RequestContextState | null } = { current: null };
