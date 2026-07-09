import * as jose from 'jose';

/** The context every mocked contract handler receives; mirrors the real services' shape. */
export interface MockContext extends Record<string, unknown> {
  readonly actingUserId: string | null;
}

/**
 * Derives the acting user from a request's forwarded `authorization` bearer, standing in for the
 * edge's s2s token minting: the bearer is decoded (never verified — this is in-process) and its
 * `sub` claim, when present, names the acting user. A missing, malformed, or subject-less bearer
 * is a verified-anonymous caller, mirroring what the edge itself would mint in that case.
 */
export function resolveSessionContext(request: Request): MockContext {
  const authorization = request.headers.get('authorization');

  if (authorization === null || !authorization.startsWith('Bearer ')) {
    return { actingUserId: null };
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const sub = jose.decodeJwt(token).sub;

    return { actingUserId: typeof sub === 'string' ? sub : null };
  } catch {
    return { actingUserId: null };
  }
}
