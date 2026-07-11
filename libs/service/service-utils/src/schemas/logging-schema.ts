import { z } from 'zod';

/**
 * Reusable schema for LOGGING environment variable.
 * Enforces our standard logging levels across all services.
 */
export const LoggingSchema = z.enum(['debug', 'info', 'warn', 'error']).optional().default('info');
