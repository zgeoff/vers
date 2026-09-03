import { createServerFn } from '@tanstack/react-start';
import { runDisableTwoFactorAuth } from './run-disable-two-factor-auth';

export const disableTwoFactorAuth = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('disableTwoFactorAuth expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runDisableTwoFactorAuth(ctx.data));
