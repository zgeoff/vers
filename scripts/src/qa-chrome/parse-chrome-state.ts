import { z } from 'zod';
import type { ChromeState } from './types';

const savedRouteSchema = z.object({
  dev: z.string(),
  dst: z.string(),
  family: z.enum(['inet', 'inet6']),
  gateway: z.string().nullable(),
  metric: z.number().nullable(),
  prefsrc: z.string().nullable(),
  protocol: z.string().nullable(),
  scope: z.string().nullable(),
});

const networkCutSchema = z.object({
  interfaceName: z.string(),
  routes: z.array(savedRouteSchema),
});

const namespaceSchema = z.object({
  cut: networkCutSchema.nullable(),
  holderPID: z.number().int().positive(),
});

const chromeStateSchema = z.object({
  leaderPID: z.number().int().positive(),
  leaderStartTime: z.string(),
  namespace: namespaceSchema.nullable(),
  port: z.number().int().min(1).max(65_535),
}) satisfies z.ZodType<ChromeState>;

export function parseChromeState(text: string): ChromeState {
  const parsed: unknown = JSON.parse(text);

  return chromeStateSchema.parse(parsed);
}
