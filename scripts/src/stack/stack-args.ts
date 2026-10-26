import type { Args } from 'gunshi';
import { parseServiceArg } from './utils/parse-service-arg';

export const STACK_ARGS = {
  start: {
    service: {
      description: 'service to start',
      parse: parseServiceArg,
      required: false,
      type: 'positional',
    },
    build: {
      default: false,
      description: 'build images before starting',
      short: 'b',
      type: 'boolean',
    },
    'force-recreate': {
      default: false,
      description: 'force recreation of containers',
      short: 'f',
      type: 'boolean',
    },
  },
  stop: {
    service: {
      description: 'service to stop',
      parse: parseServiceArg,
      required: false,
      type: 'positional',
    },
  },
  rm: {
    service: {
      description: 'service to remove',
      parse: parseServiceArg,
      required: false,
      type: 'positional',
    },
  },
  logs: {
    service: {
      description: 'service to follow logs for',
      parse: parseServiceArg,
      required: false,
      type: 'positional',
    },
  },
  exec: {
    service: {
      description: 'service to execute command in',
      parse: parseServiceArg,
      type: 'positional',
    },
    command: {
      description: 'command to execute; put a command that takes flags after --',
      multiple: true,
      type: 'positional',
    },
  },
} as const satisfies Record<string, Args>;
