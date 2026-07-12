import { createServerFn } from '@tanstack/react-start';
import { createCompositeComponent } from '@tanstack/react-start/rsc';
import * as z from 'zod';
import { pickWorldMapNodeCodexMessage } from './pick-world-map-node-codex-message';

const GetWorldMapNodeCodexFragmentInputSchema = z.object({ difficulty: z.number() });

export const getWorldMapNodeCodexFragment = createServerFn({ method: 'GET' })
  .validator((input: unknown) => GetWorldMapNodeCodexFragmentInputSchema.parse(input))
  .handler(async (ctx) => {
    const message = pickWorldMapNodeCodexMessage(ctx.data.difficulty);

    const src = await createCompositeComponent(() => (
      <p data-testid="world-map-node-codex">{message}</p>
    ));

    return { src };
  });
