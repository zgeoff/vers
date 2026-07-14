import type { ServiceName } from '@vers/service-auth';

/**
 * Resolves the origin a service's mock backend mounts at: the same `<NAME>_SERVICE_URL` env vars
 * the SSR service clients read, falling back to the real services' dev ports, so a mock backend
 * and the client calls it intercepts always agree on origin.
 */
export function resolveServiceURL(service: ServiceName): string {
  return (
    process.env[`${service.toUpperCase()}_SERVICE_URL`] ?? `http://localhost:${DEV_PORTS[service]}`
  );
}

const DEV_PORTS: Readonly<Record<ServiceName, number>> = {
  activity: 3006,
  avatar: 3005,
  email: 3007,
  keys: 3008,
  replay: 3009,
  session: 3002,
  user: 3003,
  verification: 3004,
};
