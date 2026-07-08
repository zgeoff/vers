import { createServerFn } from '@tanstack/react-start';
import { verifyOTPHandler } from './verify-otp-handler';

/** The verify-otp form's submit action; field-level validation happens once inside the handler. */
export const verifyOTP = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('verifyOTP expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => verifyOTPHandler(ctx.data));
