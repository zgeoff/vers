import { getClientIPAddress } from './get-client-ip-address';
import type { Middleware } from './middleware';

/**
 * Routes carrying auth-sensitive mutations or account state; matched against the request
 * pathname, mirroring the old Hono middleware's route classification.
 */
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

type RateLimitTier = 'default' | 'strict' | 'strong';

interface RateLimitBucket {
  readonly limit: number;
  readonly windowMs: number;
}

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface MakeRateLimiterOptions {
  readonly maxMultiple: number;
}

/**
 * Builds the tiered, in-memory rate limiter the old Hono middleware enforced: a strict per-IP
 * budget for mutating requests against auth-sensitive routes, a stronger budget for read access to
 * those same routes, and a generous default budget for everything else.
 */
export function makeRateLimiter(options: MakeRateLimiterOptions): Middleware {
  const windows = new Map<string, RateLimitWindow>();

  const buckets: Readonly<Record<RateLimitTier, RateLimitBucket>> = {
    default: { limit: 1000 * options.maxMultiple, windowMs: 60_000 },
    strict: { limit: 10 * options.maxMultiple, windowMs: 60_000 },
    strong: { limit: 100 * options.maxMultiple, windowMs: 60_000 },
  };

  return (request, next) => {
    const tier = pickRateLimitTier(request);
    const key = `${tier}:${getClientIPAddress(request)}`;

    if (hasExceededRateLimit({ bucket: buckets[tier], key, windows })) {
      return Promise.resolve(new Response('Too Many Requests', { status: 429 }));
    }

    return next();
  };
}

function pickRateLimitTier(request: Request): RateLimitTier {
  const pathname = new URL(request.url).pathname;

  const isStrictRoute = STRICT_ROUTES.some((route) => pathname.includes(route));

  if (!isStrictRoute) {
    return 'default';
  }

  return SAFE_METHODS.has(request.method) ? 'strong' : 'strict';
}

interface HasExceededRateLimitOptions {
  readonly bucket: RateLimitBucket;
  readonly key: string;
  readonly windows: Map<string, RateLimitWindow>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the windows map is mutated on every call (recording each window's count/reset), and ReadonlyMap has no `.set()`
function hasExceededRateLimit(options: HasExceededRateLimitOptions): boolean {
  const now = Date.now();
  const existing = options.windows.get(options.key);

  if (!existing || existing.resetAt <= now) {
    options.windows.set(options.key, { count: 1, resetAt: now + options.bucket.windowMs });

    return false;
  }

  existing.count += 1;

  return existing.count > options.bucket.limit;
}
