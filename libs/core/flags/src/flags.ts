import type { FlagDefinition } from './types';

export const FLAGS = {
  'game-renderer': {
    defaultValue: true,
    description:
      'Live WebGPU/R3F game canvas and avatar satellite; off renders inert placeholder canvases',
  },
  market: { defaultValue: false, description: 'Market screen and its listings' },
} as const satisfies Readonly<Record<string, FlagDefinition>>;
