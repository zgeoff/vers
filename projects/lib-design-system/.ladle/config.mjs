/** @type {import('@ladle/react').UserConfig} */
const config = {
  addons: {
    theme: {
      default: 'dark',
      enabled: true,
    },
  },
  // resolved relative to this file so loaders running from other directories (knip's ladle
  // plugin walks from the repo root) find the same config ladle itself uses
  viteConfig: new URL('../vite.config.ts', import.meta.url).pathname,
};

export default config;
