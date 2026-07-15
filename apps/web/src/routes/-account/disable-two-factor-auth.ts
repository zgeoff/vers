import { createServerFn } from '@tanstack/react-start';
import { runDisableTwoFactorAuth } from './run-disable-two-factor-auth';

/**
 * The account hub's disable-2FA submit action.
 */
export const disableTwoFactorAuth = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('disableTwoFactorAuth expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runDisableTwoFactorAuth(ctx.data));
