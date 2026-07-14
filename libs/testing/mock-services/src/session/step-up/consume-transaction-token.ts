import * as db from '../../db';
import { os } from '../os';

/**
 * Marks a step-up transaction token's `jti` as spent. A `jti` already on record — regardless of
 * the `expiresAt` this call carries — reports `consumed: false`, so a replayed token never
 * succeeds twice even if its original expiry has since passed.
 */
export const consumeTransactionToken = os.stepUp.consumeTransactionToken.handler(async (opts) => {
  const existing = db.usedTransactionTokenCollection.findFirst((q) =>
    q.where({ jti: opts.input.jti }),
  );

  if (existing !== undefined) {
    return { consumed: false };
  }

  await db.usedTransactionTokenCollection.create({
    expiresAt: opts.input.expiresAt,
    jti: opts.input.jti,
  });

  return { consumed: true };
});
