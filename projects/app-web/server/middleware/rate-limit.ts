import type { Context, Next } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { Routes } from '~/types';

const IS_PROD = process.env['NODE_ENV'] === 'production';
const maxMultiple = !IS_PROD || process.env['PLAYWRIGHT_TEST_BASE_URL'] ? 10_000 : 1;

type RateLimit = Parameters<typeof rateLimiter>[0];

const rateLimitDefault: RateLimit = {
  keyGenerator: (ctx: Context) => ctx.get('ipAddress'),
  limit: 1000 * maxMultiple,
  windowMs: 60 * 1000, // 1 minute
};

// used for secure routes & methods i.e. POST request for /login
const strictRateLimit = rateLimiter({
  ...rateLimitDefault,
  limit: 10 * maxMultiple,
});

// uses for access to secure routes e.g. GET requests for /login
const strongRateLimit = rateLimiter({
  ...rateLimitDefault,
  limit: 100 * maxMultiple,
});

// used for all other routes
const defaultRateLimit = rateLimiter(rateLimitDefault);

// apply a stricter rate limit to these routes
const strictRoutes = [
  Routes.Login,
  Routes.Signup,
  Routes.VerifyOTP,
  Routes.Onboarding,
  Routes.ResetPassword,
  Routes.Account,
  Routes.AccountVerify2FA,
  Routes.AccountChangePassword,
];

export function rateLimit(ctx: Context<object, string>, next: Next) {
  const path = ctx.req.url;
  const { method } = ctx.req;

  const isStrictRoute = strictRoutes.some((p) => path.includes(p));
  const isSecureMethod = method !== 'GET' && method !== 'HEAD';

  if (isStrictRoute && isSecureMethod) {
    return strictRateLimit(ctx, next);
  }

  if (isStrictRoute) {
    return strongRateLimit(ctx, next);
  }

  return defaultRateLimit(ctx, next);
}
