import type { z } from 'zod';
import type { envSchema } from './env';

export type Env = z.infer<typeof envSchema>;
