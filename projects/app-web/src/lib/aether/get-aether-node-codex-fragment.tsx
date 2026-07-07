import { createServerFn } from '@tanstack/react-start';
import { createCompositeComponent } from '@tanstack/react-start/rsc';
import * as z from 'zod';
import { pickAetherNodeCodexMessage } from './pick-aether-node-codex-message';

const GetAetherNodeCodexFragmentInputSchema = z.object({ difficulty: z.number() });

/**
 * Renders the aether node detail view's codex fragment server-side and hands back a Composite
 * Component source, same as the index route's session-badge fragment. Content is a minimal stub
 * lore keyed by difficulty until a real codex service exists — the slot/composite machinery this
 * establishes is the reusable part. Untestable end to end under `bun test`: `createCompositeComponent`
 * resolves to a client-build stub that unconditionally throws, since `bun test` resolves package
 * exports without the `react-server` condition. Message selection is a pure unit with its own tests.
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
