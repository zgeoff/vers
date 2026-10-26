import type { Args } from 'gunshi';

export const DEPLOY_APP_ARGS = {
  app: {
    description: 'fly app name from the manifest',
    metavar: 'name',
    required: true,
    type: 'string',
  },
} as const satisfies Args;
