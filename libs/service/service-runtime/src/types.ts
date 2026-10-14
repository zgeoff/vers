import type { TokenIssuer } from '@vers/service-auth';
import type pino from 'pino';

export interface ServiceContext {
  actingSessionID: null | string;

  actingUserID: null | string;
  issuer: TokenIssuer;
  logger: pino.Logger;

  traceID: string;
}
