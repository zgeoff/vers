import type pino from 'pino';

export interface ServiceContext {
  actingSessionID: null | string;

  actingUserID: null | string;
  logger: pino.Logger;

  traceID: string;
}
