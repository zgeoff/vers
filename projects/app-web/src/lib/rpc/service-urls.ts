/** The four service contracts this app's client lane talks to. */
export type ServiceName = 'avatar' | 'session' | 'user' | 'verification';

/**
 * Each service's origin for the SSR path, direct-to-service. Matches the real services' own dev
 * ports (see each service's own `.env.development`); overridable per-env for the deployed
 * topology. Every call in this phase is intercepted by the mock backend regardless of which
 * origin it names.
 */
export const SERVICE_URLS: Readonly<Record<ServiceName, string>> = {
  avatar: process.env['AVATAR_SERVICE_URL'] ?? 'http://localhost:3005',
  session: process.env['SESSION_SERVICE_URL'] ?? 'http://localhost:3002',
  user: process.env['USER_SERVICE_URL'] ?? 'http://localhost:3003',
  verification: process.env['VERIFICATION_SERVICE_URL'] ?? 'http://localhost:3004',
};
