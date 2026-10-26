import { parseIntegerOption } from '@vers/scripts';
import type { Args } from 'gunshi';

export const QA_SEED_ARGS = {
  user: {
    description: 'account name; the address is <name>@qa.versidle.com',
    metavar: 'name',
    required: true,
    type: 'string',
  },
  level: {
    description: 'avatar level, at least 1',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    required: true,
    type: 'custom',
  },
  runs: {
    default: 0,
    description: 'completed, verified runs to seed on the origin node',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 0),
    type: 'custom',
  },
  'two-factor': {
    default: false,
    description: 'enable two-factor sign-in and print its secret',
    type: 'boolean',
  },
  password: {
    description: 'password to set; generated and printed when absent',
    metavar: 'password',
    type: 'string',
  },
  yes: {
    default: false,
    description: 'act on a database host that is not a loopback address',
    type: 'boolean',
  },
} as const satisfies Args;
