import type { ServiceAudience, ServiceName } from './types';

/**
 * Builds the `aud` claim a service registers and every s2s token must carry to reach it.
 */
export function buildServiceAudience(name: ServiceName): ServiceAudience {
  return `service-${name}`;
}
