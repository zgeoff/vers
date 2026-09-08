import type { ColdPathVerdict, FleetRequest, RouteCount } from './types';

const TOP_ROUTES = 5;

export function pickColdPathVerdict(requests: ReadonlyArray<FleetRequest>): ColdPathVerdict {
  if (requests.length === 0) {
    return { kind: 'idle' };
  }

  const counts = new Map<string, number>();

  for (const request of requests) {
    counts.set(request.route, (counts.get(request.route) ?? 0) + 1);
  }

  const routes = [...counts.entries()]
    .map(([route, count]): RouteCount => ({ count, route }))
    .toSorted((a, b) => b.count - a.count || compareRoutes(a.route, b.route))
    .slice(0, TOP_ROUTES);

  return { count: requests.length, kind: 'active', routes };
}

// code-unit order keeps the printed breakdown identical across locales
function compareRoutes(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}
