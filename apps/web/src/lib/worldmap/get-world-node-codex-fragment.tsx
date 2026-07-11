import { createServerFn } from '@tanstack/react-start';
import { createCompositeComponent } from '@tanstack/react-start/rsc';
import * as z from 'zod';
import { pickWorldNodeCodexMessage } from './pick-world-node-codex-message';

const GetWorldNodeCodexFragmentInputSchema = z.object({ difficulty: z.number() });

export const getWorldNodeCodexFragment = createServerFn({ method: 'GET' })
  .validator((input: unknown) => GetWorldNodeCodexFragmentInputSchema.parse(input))
  .handler(async (ctx) => {
    const message = pickWorldNodeCodexMessage(ctx.data.difficulty);

    const src = await createCompositeComponent(() => (
      <p data-testid="world-node-codex">{message}</p>
    ));

    return { src };
  });
