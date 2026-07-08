import * as db from '../../db';
import { os } from './os';

export const resetPassword = os.resetPassword.handler(async (opts) => {
  const user = db.userCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (user.passwordResetToken === null) {
    throw opts.errors.INVALID_RESET_TOKEN({ data: {} });
  }

  if (
    user.passwordResetTokenExpiresAt !== null &&
    user.passwordResetTokenExpiresAt.getTime() < Date.now()
  ) {
    throw opts.errors.RESET_TOKEN_EXPIRED({ data: {} });
  }

  if (user.passwordResetToken !== opts.input.resetToken) {
    throw opts.errors.INVALID_RESET_TOKEN({ data: {} });
  }

  await db.userCollection.update(user, {
    data(record) {
      record.password = opts.input.password;
      record.passwordResetToken = null;
      record.passwordResetTokenExpiresAt = null;
    },
  });

  for (const session of db.sessionCollection.findMany((q) => q.where({ userID: user.id }))) {
    db.sessionCollection.delete(session);
  }

  return {};
});
