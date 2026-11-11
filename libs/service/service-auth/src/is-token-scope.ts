import { SERVICE_TOKEN_SCOPES } from './token-claims';
import type { TokenScope } from './types';

export function isTokenScope(value: unknown): value is TokenScope {
  return SERVICE_TOKEN_SCOPES.some((scope) => scope === value);
}
