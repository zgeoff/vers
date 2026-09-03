import { createServerFn } from '@tanstack/react-start';
import { verifyTwoFactorSetupHandler } from './verify-two-factor-setup-handler';

export const verifyTwoFactorSetup = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('verifyTwoFactorSetup expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => verifyTwoFactorSetupHandler(ctx.data));
