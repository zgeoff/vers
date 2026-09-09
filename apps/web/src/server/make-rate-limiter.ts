import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from '../lib/auth/build-auth-session-config';
import { findSessionID } from './find-session-id';
import type { SessionUnsealConfig } from './find-session-id';
import { getClientIPAddress } from './get-client-ip-address';
import type { Middleware } from './middleware';

const RPC_PATH_PREFIX = '/api/rpc';
const WINDOW_SWEEP_THRESHOLD = 1000;

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
  const sessionConfig = buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS);

  const windows = new Map<string, RateLimitWindow>();

  const buckets: Readonly<Record<RateLimitTier, RateLimitBucket>> = {
    default: { limit: 1000 * options.maxMultiple, windowMs: 60_000 },
    rpc: { limit: 60 * options.maxMultiple, windowMs: 60_000 },
    strict: { limit: 10 * options.maxMultiple, windowMs: 60_000 },
    strong: { limit: 100 * options.maxMultiple, windowMs: 60_000 },
  };

  return async (request, next) => {
    const tier = pickRateLimitTier(request);
    const bucket = buckets[tier];

    const key =
      tier === 'rpc'
        ? await resolveRPCRateLimitKey(request, sessionConfig)
        : `${tier}:${getClientIPAddress(request)}`;

    const now = clock.now();
    const window = advanceRateLimitWindow({ key, now, windowMs: bucket.windowMs, windows });

    if (window.count > bucket.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));

      return new Response('Too Many Requests', {
        headers: { 'retry-after': String(retryAfterSeconds) },
        status: 429,
      });
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

async function resolveRPCRateLimitKey(
  request: Request,
  sessionConfig: SessionUnsealConfig,
): Promise<string> {
  const sessionID = await findSessionID(request, sessionConfig);

  return sessionID === null ? `rpc:ip:${getClientIPAddress(request)}` : `rpc:session:${sessionID}`;
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
    if (options.windows.size >= WINDOW_SWEEP_THRESHOLD) {
      sweepExpiredWindows(options.windows, options.now);
    }

    const fresh: RateLimitWindow = { count: 1, resetAt: options.now + options.windowMs };

    options.windows.set(options.key, fresh);

    return fresh;
  }

  existing.count += 1;

  return existing;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the sweep deletes from the windows map in place, and ReadonlyMap has no `.delete()`
function sweepExpiredWindows(windows: Map<string, RateLimitWindow>, now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) {
      windows.delete(key);
    }
  }
}
