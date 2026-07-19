import { z } from 'zod';

export const NodeEnvSchema = z.enum(['development', 'e2e', 'test', 'production']);
