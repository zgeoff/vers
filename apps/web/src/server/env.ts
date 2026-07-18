import { expandEnv } from '@vers/service-utils';
import { WEB_ENV_SCHEMA } from './web-env-schema';

// `expandEnv` is plain-function generic, not zod-typed, so it stays reusable regardless of which
// zod produced its input.
export const env = expandEnv(WEB_ENV_SCHEMA.parse(process.env));
