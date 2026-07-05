import crypto from 'node:crypto';
import type { Context, Next } from 'hono';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function setCSPNonce(ctx: Context, next: Next) {
  const nonce = crypto.randomBytes(16).toString('hex');

  ctx.set('cspNonce', nonce);

  await next();
}
