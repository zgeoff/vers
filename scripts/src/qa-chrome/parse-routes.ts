import { z } from 'zod';
import type { RouteFamily, SavedRoute } from './types';

const routeSchema = z.object({
  dev: z.string(),
  dst: z.string(),
  flags: z.array(z.string()).optional(),
  gateway: z.string().optional(),
  metric: z.number().optional(),
  prefsrc: z.string().optional(),
  protocol: z.string().optional(),
  scope: z.string().optional(),
});

const routesSchema = z.array(routeSchema);

export function parseRoutes(text: string, family: RouteFamily): Array<SavedRoute> {
  // ip prints nothing at all, not an empty array, for a family with no routes
  const json = text === '' ? '[]' : text;
  const parsed: unknown = JSON.parse(json);

  return routesSchema.parse(parsed).map((route) => ({
    dev: route.dev,
    dst: route.dst,
    family,
    gateway: route.gateway ?? null,
    isOnlink: route.flags?.includes('onlink') ?? false,
    metric: route.metric ?? null,
    prefsrc: route.prefsrc ?? null,
    protocol: route.protocol ?? null,
    scope: route.scope ?? null,
  }));
}
