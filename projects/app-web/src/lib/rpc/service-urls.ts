export type ServiceName = 'avatar' | 'session' | 'user' | 'verification';

/**
 * Each service's origin for the SSR direct-to-service path, defaulting to the real services' dev
 * ports. Every call is currently intercepted by the mock backend regardless of which origin it
 * names.
 */
export const SERVICE_URLS: Readonly<Record<ServiceName, string>> = {
  avatar: process.env['AVATAR_SERVICE_URL'] ?? 'http://localhost:3005',
  session: process.env['SESSION_SERVICE_URL'] ?? 'http://localhost:3002',
  user: process.env['USER_SERVICE_URL'] ?? 'http://localhost:3003',
  verification: process.env['VERIFICATION_SERVICE_URL'] ?? 'http://localhost:3004',
};
