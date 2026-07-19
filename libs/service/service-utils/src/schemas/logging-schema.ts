import { z } from 'zod';

export const LoggingSchema = z.enum(['debug', 'info', 'warn', 'error']).optional().default('info');
