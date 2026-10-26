import type { Args } from 'gunshi';

export const CHECK_CONTENT_DIGEST_ARGS = {
  base: {
    description: 'reject a change to any digest recorded at this git ref',
    metavar: 'ref',
    type: 'string',
  },
} as const satisfies Args;
