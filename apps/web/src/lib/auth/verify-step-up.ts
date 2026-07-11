import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from './require-auth';
import { VerifyStepUpInputSchema, verifyStepUpHandler } from './verify-step-up-handler';

/**
 * The step-up challenge island's submit action, shared by every gated mutation's inline prompt.
 */
export const verifyStepUp = createServerFn({ method: 'POST' })
  .validator((input: unknown) => VerifyStepUpInputSchema.parse(input))
  .handler(async (ctx) => {
    await requireAuth();

    return verifyStepUpHandler(ctx.data);
  });
