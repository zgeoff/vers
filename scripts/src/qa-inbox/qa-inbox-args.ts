import type { Args } from 'gunshi';
import { parseSeconds } from '../utils/parse-seconds';
import { MAX_LIST_LIMIT } from './max-list-limit';
import type { VerificationKindOption } from './types';

const DEFAULT_TIMEOUT_SECONDS = 120;
const DEFAULT_LIST_LIMIT = 20;

const KIND_CHOICES = [
  'welcome',
  'change-email',
  'reset-password',
  'two-factor',
  'any',
] as const satisfies ReadonlyArray<VerificationKindOption>;

export const QA_INBOX_ARGS = {
  wait: {
    to: {
      description: 'recipient address on the receiving domain',
      metavar: 'address',
      required: true,
      type: 'string',
    },
    kind: {
      choices: KIND_CHOICES,
      default: 'any',
      description: 'which template to read',
      type: 'enum',
    },
    timeout: {
      default: DEFAULT_TIMEOUT_SECONDS,
      description: 'seconds to keep polling',
      metavar: 'seconds',
      parse: parseSeconds,
      type: 'custom',
    },
    json: { default: false, description: 'print the result as JSON', type: 'boolean' },
  },
  list: {
    to: {
      description: 'keep only emails sent to this address',
      metavar: 'address',
      type: 'string',
    },
    limit: {
      default: DEFAULT_LIST_LIMIT,
      description: `emails to print, at most ${MAX_LIST_LIMIT}`,
      metavar: 'n',
      parse: parseLimit,
      type: 'custom',
    },
  },
  show: {
    id: { description: 'received email id from list', type: 'positional' },
    json: { default: false, description: 'print the email as JSON', type: 'boolean' },
  },
} as const satisfies Record<string, Args>;

function parseLimit(value: string): number {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw new Error(`expected an integer from 1 to ${MAX_LIST_LIMIT}, got "${value}"`);
  }

  return limit;
}
