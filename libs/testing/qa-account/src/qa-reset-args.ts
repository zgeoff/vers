import type { Args } from 'gunshi';

export const QA_RESET_ARGS = {
  user: {
    description: 'account name; the address is <name>@qa.versidle.com',
    metavar: 'name',
    required: true,
    type: 'string',
  },
  all: {
    default: false,
    description: 'delete the account itself instead of resetting its progress',
    type: 'boolean',
  },
  yes: {
    default: false,
    description: 'act on a database host that is not a loopback address',
    type: 'boolean',
  },
} as const satisfies Args;
