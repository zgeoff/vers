import { defineConfig } from '@pandacss/dev';
import { preset } from '@vers/panda-preset';

export default defineConfig({
  exclude: [],
  globalCss: {
    // route view transitions: `same-scene` and `scene-swap` both cross-fade the root snapshot
    // (the browser default), `scene-swap` just runs it slower to read as a bigger change;
    // `to-ambient`/`to-focus`/`to-hidden` are left to the default crossfade untouched
    [[
      ':root:active-view-transition-type(same-scene)::view-transition-old(root)',
      ':root:active-view-transition-type(same-scene)::view-transition-new(root)',
      ':root:active-view-transition-type(scene-swap)::view-transition-old(root)',
      ':root:active-view-transition-type(scene-swap)::view-transition-new(root)',
    ].join(', ')]: {
      animationDuration: 'fast',
    },
    [[
      ':root:active-view-transition-type(scene-swap)::view-transition-old(root)',
      ':root:active-view-transition-type(scene-swap)::view-transition-new(root)',
    ].join(', ')]: {
      animationDuration: 'slow',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)': {
        animationDuration: '0.01ms !important',
      },
    },
  },
  include: ['../lib-design-system/src/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  jsxFramework: 'react',
  outdir: 'src/styled-system',
  preflight: true,
  presets: [preset],
  shorthands: false,
});
