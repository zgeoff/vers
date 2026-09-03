import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from './require-auth';
import { VerifyStepUpInputSchema, verifyStepUpHandler } from './verify-step-up-handler';

export const verifyStepUp = createServerFn({ method: 'POST' })
  .validator((input: unknown) => VerifyStepUpInputSchema.parse(input))
  .handler(async (ctx) => {
    await requireAuth();

    return verifyStepUpHandler(ctx.data);
  });
