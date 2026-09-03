import * as db from '../../db';
import { os } from '../os';

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
