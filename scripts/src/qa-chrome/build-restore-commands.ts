import type { NetworkCut, SavedRoute } from './types';

export function buildRestoreCommands(cut: NetworkCut): Array<Array<string>> {
  // a route through a gateway needs the link-scope route to that gateway in place first
  const ordered = [
    ...cut.routes.filter((route) => route.gateway === null),
    ...cut.routes.filter((route) => route.gateway !== null),
  ];

  return [
    ['ip', 'link', 'set', 'dev', cut.interfaceName, 'up'],
    ...ordered.map((route) => buildRouteCommand(route)),
  ];
}

function buildRouteCommand(route: SavedRoute): Array<string> {
  const metric = route.metric === null ? null : String(route.metric);

  return [
    'ip',
    route.family === 'inet6' ? '-6' : '-4',
    'route',
    'replace',
    route.dst,
    ...toPair('via', route.gateway),
    'dev',
    route.dev,
    ...(route.isOnlink ? ['onlink'] : []),
    ...toPair('proto', route.protocol),
    ...toPair('scope', route.scope),
    ...toPair('src', route.prefsrc),
    ...toPair('metric', metric),
  ];
}

function toPair(keyword: string, value: string | null): Array<string> {
  return value === null ? [] : [keyword, value];
}
