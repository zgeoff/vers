/** @type {import('@ladle/react').UserConfig} */
const config = {
  addons: {
    theme: {
      default: 'dark',
      enabled: true,
    },
  },
  viteConfig: `${process.cwd()}/vitest.config.ts`,
};

export default config;
