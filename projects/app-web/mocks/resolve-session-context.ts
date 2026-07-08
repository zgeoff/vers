import { sessionCollection } from './db/session-collection';

/** The context every mocked contract handler receives; mirrors the real services' shape. */
export interface MockContext extends Record<string, unknown> {
  readonly actingUserId: string | null;
}

/**
 * Derives the acting user from a request's forwarded `authorization`/`cookie` headers, the same
 * two headers the isomorphic `RPCLink` forwards on the SSR path. Standing in for the edge's s2s
 * token minting: a bearer/cookie value is treated directly as a session id, looked up in the mock
 * session store.
 */
export function resolveSessionContext(request: Request): MockContext {
  const sessionID = findSessionID(request);

  if (sessionID === null) {
    return { actingUserId: null };
  }

  const session = sessionCollection.findFirst((q) => q.where({ id: sessionID }));

  if (session === undefined || session.expiresAt.getTime() <= Date.now()) {
    return { actingUserId: null };
  }

  return { actingUserId: session.userID };
}

function findSessionID(request: Request): string | null {
  const authorization = request.headers.get('authorization');

  if (authorization !== null && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  const cookieHeader = request.headers.get('cookie') ?? '';

  for (const entry of cookieHeader.split(';')) {
    const [name, ...rest] = entry.trim().split('=');

    if (name === 'session') {
      return rest.join('=') || null;
    }
  }

  return null;
}
