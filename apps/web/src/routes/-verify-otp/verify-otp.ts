import { createServerFn } from '@tanstack/react-start';
import { verifyOTPHandler } from './verify-otp-handler';

export const verifyOTP = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('verifyOTP expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => verifyOTPHandler(ctx.data));
