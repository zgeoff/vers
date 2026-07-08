import { createId } from '@paralleldrive/cuid2';
import { userCollection } from '../../db/user-collection';
import { os } from './os';

const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

export const createPasswordResetToken = os.createPasswordResetToken.handler(async (opts) => {
  const user = userCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const resetToken = createId();

  await userCollection.update(user, {
    data(record) {
      record.passwordResetToken = resetToken;

      record.passwordResetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    },
  });

  return { resetToken };
});
