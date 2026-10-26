import type { ArgSchema } from 'gunshi';
import { parseEndpoint } from './parse-endpoint';

export const ENDPOINT_ARG = {
  description: 'DevTools endpoint; defaults to QA_CDP_ENDPOINT, then 127.0.0.1:9222',
  metavar: 'host:port',
  parse: parseEndpoint,
  type: 'custom',
} as const satisfies ArgSchema;
