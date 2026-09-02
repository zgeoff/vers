import * as jose from 'jose';

export interface MockContext extends Record<string, unknown> {
  readonly actingUserID: string | null;
}

export function resolveSessionContext(request: Request): MockContext {
  const authorization = request.headers.get('authorization');

  if (authorization === null || !authorization.startsWith('Bearer ')) {
    return { actingUserID: null };
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const sub = jose.decodeJwt(token).sub;

    return { actingUserID: typeof sub === 'string' ? sub : null };
  } catch {
    return { actingUserID: null };
  }
}
