import type { ServiceName } from '@vers/service-auth';

/**
 * Each service's origin for the SSR direct-to-service path, defaulting to the real services' dev
 * ports. Every call is currently intercepted by the mock backend regardless of which origin it
 * names.
 */
export const SERVICE_URLS: Readonly<Record<ServiceName, string>> = {
  activity: process.env['ACTIVITY_SERVICE_URL'] ?? 'http://localhost:3006',
  avatar: process.env['AVATAR_SERVICE_URL'] ?? 'http://localhost:3005',
  email: process.env['EMAIL_SERVICE_URL'] ?? 'http://localhost:3007',
  session: process.env['SESSION_SERVICE_URL'] ?? 'http://localhost:3002',
  user: process.env['USER_SERVICE_URL'] ?? 'http://localhost:3003',
  verification: process.env['VERIFICATION_SERVICE_URL'] ?? 'http://localhost:3004',
};
