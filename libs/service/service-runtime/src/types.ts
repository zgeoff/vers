import type { TokenIssuer } from '@vers/service-auth';
import type { Logger } from './logging';

export interface ServiceContext {
  actingSessionID: null | string;

  actingUserID: null | string;
  issuer: TokenIssuer;
  logger: Logger;

  traceID: string;
}

export interface ResourceScope {
  readonly adopt: <T>(value: T, dispose: (value: T) => Promise<void> | void) => T;
}

export interface DisposableResourceScope extends ResourceScope {
  readonly dispose: () => Promise<void>;
}
