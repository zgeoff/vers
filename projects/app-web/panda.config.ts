import { defineConfig } from '@pandacss/dev';
import { preset } from '@vers/panda-preset';

export default defineConfig({
  exclude: [],
  include: ['../lib-design-system/src/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  jsxFramework: 'react',
  outdir: 'src/styled-system',
  preflight: true,
  presets: [preset],
  shorthands: false,
});
