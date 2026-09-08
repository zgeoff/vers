import { createHash } from 'node:crypto';
import { AUTH_SESSION_COOKIE_NAME } from '../lib/auth/build-auth-session-config';
import { getClientIPAddress } from './get-client-ip-address';
import type { Middleware } from './middleware';

const RPC_PATH_PREFIX = '/api/rpc';

const STRICT_ROUTES: ReadonlyArray<string> = [
  '/login',
  '/signup',
  '/verify-otp',
  '/onboarding',
  '/reset-password',
  '/account',
  '/account/2fa/verify',
  '/account/change-password',
];

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

type RateLimitTier = 'default' | 'rpc' | 'strict' | 'strong';

interface RateLimitBucket {
  readonly limit: number;
  readonly windowMs: number;
}

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

interface RateLimitClock {
  readonly now: () => number;
}

interface MakeRateLimiterOptions {
  readonly clock?: RateLimitClock;
  readonly maxMultiple: number;
}

export function makeRateLimiter(options: MakeRateLimiterOptions): Middleware {
  const clock = options.clock ?? { now: Date.now };

  const windows = new Map<string, RateLimitWindow>();

  const buckets: Readonly<Record<RateLimitTier, RateLimitBucket>> = {
    default: { limit: 1000 * options.maxMultiple, windowMs: 60_000 },
    rpc: { limit: 60 * options.maxMultiple, windowMs: 60_000 },
    strict: { limit: 10 * options.maxMultiple, windowMs: 60_000 },
    strong: { limit: 100 * options.maxMultiple, windowMs: 60_000 },
  };

  return (request, next) => {
    const tier = pickRateLimitTier(request);
    const bucket = buckets[tier];
    const now = clock.now();

    const window = advanceRateLimitWindow({
      key: resolveRateLimitKey(request, tier),
      now,
      windowMs: bucket.windowMs,
      windows,
    });

    if (window.count > bucket.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));

      return Promise.resolve(
        new Response('Too Many Requests', {
          headers: { 'retry-after': String(retryAfterSeconds) },
          status: 429,
        }),
      );
    }

    return next();
  };
}

function pickRateLimitTier(request: Request): RateLimitTier {
  const pathname = new URL(request.url).pathname;

  if (pathname === RPC_PATH_PREFIX || pathname.startsWith(`${RPC_PATH_PREFIX}/`)) {
    return 'rpc';
  }

  const isStrictRoute = STRICT_ROUTES.some((route) => pathname.includes(route));

  if (!isStrictRoute) {
    return 'default';
  }

  return SAFE_METHODS.has(request.method) ? 'strong' : 'strict';
}

function resolveRateLimitKey(request: Request, tier: RateLimitTier): string {
  if (tier !== 'rpc') {
    return `${tier}:${getClientIPAddress(request)}`;
  }

  const sessionCookie = findSessionCookie(request);

  // the session cookie is sealed, so its id is unreadable here without the unseal step every
  // request would then pay; a digest of the sealed value names the session just as well
  return sessionCookie === null
    ? `rpc:ip:${getClientIPAddress(request)}`
    : `rpc:session:${createHash('sha256').update(sessionCookie).digest('hex')}`;
}

function findSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');

  if (cookieHeader === null) {
    return null;
  }

  for (const pair of cookieHeader.split(';')) {
    const separatorIndex = pair.indexOf('=');

    if (
      separatorIndex !== -1 &&
      pair.slice(0, separatorIndex).trim() === AUTH_SESSION_COOKIE_NAME
    ) {
      const value = pair.slice(separatorIndex + 1).trim();

      return value === '' ? null : value;
    }
  }

  return null;
}

interface AdvanceRateLimitWindowOptions {
  readonly key: string;
  readonly now: number;
  readonly windowMs: number;
  readonly windows: Map<string, RateLimitWindow>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the windows map is mutated on every call (recording each window's count/reset), and ReadonlyMap has no `.set()`
function advanceRateLimitWindow(options: AdvanceRateLimitWindowOptions): RateLimitWindow {
  const existing = options.windows.get(options.key);

  if (!existing || existing.resetAt <= options.now) {
    const fresh: RateLimitWindow = { count: 1, resetAt: options.now + options.windowMs };

    options.windows.set(options.key, fresh);

    return fresh;
  }

  existing.count += 1;

  return existing;
}
