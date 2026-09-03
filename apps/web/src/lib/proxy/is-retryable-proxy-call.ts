import { activityContract } from '@vers/contract-activity';
import { avatarContract } from '@vers/contract-avatar';
import { emailContract } from '@vers/contract-email';
import { sessionContract } from '@vers/contract-session';
import { userContract } from '@vers/contract-user';
import { verificationContract } from '@vers/contract-verification';
import type { ServiceName } from '@vers/service-auth';
import { makeIsRetryable } from '@vers/service-utils/orpc';

type IsRetryable = (path: ReadonlyArray<string>) => boolean;

// a service the browser has no contract for is never retried through the proxy
const IS_RETRYABLE_BY_SERVICE: Readonly<Partial<Record<ServiceName, IsRetryable>>> = {
  activity: makeIsRetryable(activityContract),
  avatar: makeIsRetryable(avatarContract),
  email: makeIsRetryable(emailContract),
  session: makeIsRetryable(sessionContract),
  user: makeIsRetryable(userContract),
  verification: makeIsRetryable(verificationContract),
};

export function isRetryableProxyCall(service: ServiceName, path: ReadonlyArray<string>): boolean {
  return IS_RETRYABLE_BY_SERVICE[service]?.(path) ?? false;
}
