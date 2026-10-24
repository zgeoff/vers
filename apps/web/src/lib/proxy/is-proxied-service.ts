import type { ServiceName } from '@vers/service-auth';

// the proxy mints an app-web token for whichever browser calls it, and a service trusts that token
// for every procedure, so only the services browser code calls are reachable through it
const PROXIED_SERVICES: ReadonlySet<ServiceName> = new Set(['activity', 'avatar']);

export function isProxiedService(service: ServiceName): boolean {
  return PROXIED_SERVICES.has(service);
}
