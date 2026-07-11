import { defineConfig } from '@pandacss/dev';
import { preset } from '@vers/panda-preset';

export default defineConfig({
  exclude: [],
  include: [],
  jsxFramework: 'react',
  outdir: 'styled-system',
  preflight: true,
  presets: [preset],
  shorthands: false,
  strictPropertyValues: true,
  strictTokens: true,
});
