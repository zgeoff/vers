const { sentryEsbuildPlugin } = require('@sentry/esbuild-plugin');

exports.sourcemap = true;

// the ESM bundle inlines CommonJS deps whose require() calls survive the
// format conversion; give them a real require so they work under node
exports.banner = {
  js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
};

exports.plugins = [
  sentryEsbuildPlugin({
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: 'vers-idle',
    project: 'service-user',
    release: {
      name: process.env.COMMIT_SHA,
    },
  }),
];
