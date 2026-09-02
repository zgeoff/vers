import type { ServiceAudience, ServiceName } from './types';

export function buildServiceAudience(name: ServiceName): ServiceAudience {
  return `service-${name}`;
}
