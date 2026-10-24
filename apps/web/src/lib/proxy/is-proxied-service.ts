import type { ServiceName } from '@vers/service-auth';

// the session service issues step-up grants and sessions to whichever caller asks, so only the
// edge's own server code may reach it
const UNPROXIED_SERVICES: ReadonlySet<ServiceName> = new Set(['session']);

export function isProxiedService(service: ServiceName): boolean {
  return !UNPROXIED_SERVICES.has(service);
}
