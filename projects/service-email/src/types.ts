import type { z } from 'zod';
import type { envSchema } from './env';

export type Context = Record<string, never>;

export type Env = z.infer<typeof envSchema>;
