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
    description: 'avatar level, from 1 to 1000; a level above 1 needs --runs',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    required: true,
    type: 'custom',
  },
  runs: {
    default: 0,
    description: 'completed, verified runs to seed on the origin node, at most 20',
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
  origin: {
    description: 'origin of the web app whose QA endpoint seeds the account',
    metavar: 'url',
    required: true,
    type: 'string',
  },
  yes: {
    default: false,
    description: 'seed through an origin that is not a loopback address',
    type: 'boolean',
  },
} as const satisfies Args;
