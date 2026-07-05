import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['projects/*/vitest.config.ts', 'projects/app-web/vite.config.ts']);
