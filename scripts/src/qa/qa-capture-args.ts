import type { Args } from 'gunshi';
import { ENDPOINT_ARG } from './endpoint-arg';

const DEFAULT_PATH_FILTER = '/api/rpc/';

export const QA_CAPTURE_ARGS = {
  endpoint: ENDPOINT_ARG,
  path: {
    default: DEFAULT_PATH_FILTER,
    description: 'log only requests whose url contains this',
    metavar: 'substring',
    type: 'string',
  },
  'worker-url': {
    description: 'attach only to shared workers whose url contains this',
    metavar: 'substring',
    type: 'string',
  },
} as const satisfies Args;
