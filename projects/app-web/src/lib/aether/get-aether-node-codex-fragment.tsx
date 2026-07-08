import { createServerFn } from '@tanstack/react-start';
import { createCompositeComponent } from '@tanstack/react-start/rsc';
import * as z from 'zod';
import { pickAetherNodeCodexMessage } from './pick-aether-node-codex-message';

const GetAetherNodeCodexFragmentInputSchema = z.object({ difficulty: z.number() });

/**
 * Content is a minimal stub lore keyed by difficulty until a real codex service exists — the
 * slot/composite machinery this fragment establishes is the reusable part.
 */
export const getAetherNodeCodexFragment = createServerFn({ method: 'GET' })
  .validator((input: unknown) => GetAetherNodeCodexFragmentInputSchema.parse(input))
  .handler(async (ctx) => {
    const message = pickAetherNodeCodexMessage(ctx.data.difficulty);

    const src = await createCompositeComponent(() => (
      <p data-testid="aether-node-codex">{message}</p>
    ));

    return { src };
  });
