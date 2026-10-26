import type { TokenIssuer } from '@vers/service-auth';
import type { Logger } from './logging';

export interface ServiceContext {
  actingSessionID: null | string;

  actingUserID: null | string;
  issuer: TokenIssuer;
  logger: Logger;

  traceID: string;
}
