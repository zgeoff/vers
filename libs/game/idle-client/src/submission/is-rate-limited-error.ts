import { ORPCError } from '@orpc/client';

const TOO_MANY_REQUESTS_STATUS = 429;

export function isRateLimitedError(error: unknown): boolean {
  return error instanceof ORPCError && error.status === TOO_MANY_REQUESTS_STATUS;
}
