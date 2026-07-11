import pandacss from '@pandacss/dev/postcss';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    postcss: {
      plugins: [pandacss, autoprefixer],
    },
  },
  plugins: [react()],
});
