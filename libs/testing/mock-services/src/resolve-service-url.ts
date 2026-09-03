import type { ServiceName } from '@vers/service-auth';

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
