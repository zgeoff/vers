import crypto from 'node:crypto';
import type { Context, Next } from 'hono';

export async function setCSPNonce(ctx: Context, next: Next) {
  const nonce = crypto.randomBytes(16).toString('hex');

  ctx.set('cspNonce', nonce);

  await next();
}
