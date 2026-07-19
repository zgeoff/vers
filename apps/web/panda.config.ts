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

    // a meta-to-meta swap keeps its sheet open: hold the opaque frame steady across the swap (only
    // its inner `sheet-content` crossfades) so a solid panel always covers the live canvas behind it
    [[
      ':root:active-view-transition-type(same-scene)::view-transition-old(sheet)',
      ':root:active-view-transition-type(same-scene)::view-transition-new(sheet)',
    ].join(', ')]: {
      animationName: 'none',
    },

    // the transition layer paints groups by group order, not page z-index, so pin the always-on
    // rail above the sheet and its scrim instead of letting it flatten under them
    '::view-transition-group(nav-rail)': {
      zIndex: '[100]',
    },

    // closing a sheet returns to a canvas scene: slide the panel and its content back down together
    // instead of the default fade, mirroring the open
    [[
      ':root:active-view-transition-type(to-focus)::view-transition-old(sheet)',
      ':root:active-view-transition-type(to-focus)::view-transition-old(sheet-content)',
    ].join(', ')]: {
      animationName: '[slideOutToBottom]',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)': {
        animationDuration: '0.01ms !important',
      },
    },
  },
  include: [
    '../../libs/design/design-system/src/**/*.{ts,tsx}',
    '../../libs/game/idle-client/src/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  jsxFramework: 'react',
  outdir: 'src/styled-system',
  preflight: true,
  presets: [preset],
  shorthands: false,
});
