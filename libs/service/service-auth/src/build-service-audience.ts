import type { AudienceName, ServiceAudience } from './types';

export function buildServiceAudience(name: AudienceName): ServiceAudience {
  return `service-${name}`;
}
