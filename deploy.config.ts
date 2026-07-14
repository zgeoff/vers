import { defineDeployManifest } from '@vers/scripts';
import { z } from 'zod';

const rpcUnauthorizedBody = z.object({
  code: z.literal('UNAUTHORIZED'),
  data: z.object({ reason: z.literal('missing-session') }),
  defined: z.literal(true),
});

const rpcUnauthorizedReply = z.object({
  json: rpcUnauthorizedBody,
});

/**
 * Fleet manifest for the deploy CLI (`bun run deploy`): which Fly apps exist,
 * what makes each one stale, and how a deploy is verified. Staleness compares
 * HEAD against the `GIT_SHA` each deploy stamps into machine env, so a
 * skipped or cancelled rollout self-heals on the next push. The anonymous RPC
 * probe must round-trip the contract's typed UNAUTHORIZED through
 * app-web → flycast → service-user, which no /health check can see.
 */
export default defineDeployManifest({
  apps: [
    {
      app: 'vers-service-activity',
      configDir: 'services/activity',
      dockerfile: 'services/activity/Dockerfile',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-activity' },
    },
    {
      app: 'vers-service-avatar',
      configDir: 'services/avatar',
      dockerfile: 'services/avatar/Dockerfile',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-avatar' },
    },
    {
      app: 'vers-service-email',
      configDir: 'services/email',
      dockerfile: 'services/email/Dockerfile',
      scheduledMachines: [
        {
          command: ['/usr/local/bin/sweep'],
          name: 'email-sweeper',
          region: 'syd',
          schedule: 'hourly',
        },
      ],
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-email' },
    },
    {
      app: 'vers-service-keys',
      configDir: 'services/keys',
      dockerfile: 'services/keys/Dockerfile',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-keys' },
    },
    {
      app: 'vers-service-session',
      configDir: 'services/session',
      dockerfile: 'services/session/Dockerfile',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-session' },
    },
    {
      app: 'vers-service-user',
      configDir: 'services/user',
      dockerfile: 'services/user/Dockerfile',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
    },
    {
      app: 'vers-service-verification',
      configDir: 'services/verification',
      dockerfile: 'services/verification/Dockerfile',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-verification' },
    },
    {
      app: 'vers-service-replay',
      buildArgsFromEnv: ['SIM_ENGINE_HASH', 'BUN_VERSION'],
      configDir: 'services/replay',
      dockerfile: 'services/replay/Dockerfile',
      simVersionProvider: true,
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-replay' },
    },
    {
      app: 'vers-app-web',
      buildArgsFromEnv: ['SENTRY_AUTH_TOKEN', 'VITE_SENTRY_DSN', 'VITE_SIM_ENGINE_HASH'],
      configDir: 'apps/web',
      dockerfile: 'apps/web/Dockerfile',
      minStartedMachines: 1,
      probes: [
        { expectStatus: 200, kind: 'http', url: 'https://vers-app-web.fly.dev/health' },
        {
          body: { json: {} },
          expect: (body) => rpcUnauthorizedReply.safeParse(body).success,
          kind: 'json-post',
          url: 'https://vers-app-web.fly.dev/api/rpc/user/getCurrentUser',
        },
      ],
      trigger: { kind: 'turbo-affected', pkg: '@vers/web' },
    },
    {
      app: 'vers-bugsink',
      configDir: 'apps/bugsink',
      trigger: { globs: ['apps/bugsink/**'], kind: 'paths' },
    },
  ],
});
