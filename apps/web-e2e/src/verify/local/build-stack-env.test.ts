import { expect, test } from 'bun:test';
import { buildServiceEnv, buildWebEnv } from './build-stack-env';

test('#buildServiceEnv points a service at its own port, the run database and the stack keys', () => {
  const env = buildServiceEnv({
    service: 'avatar',
    ports: {
      web: 4100,
      resend: 4101,
      umami: 4102,
      services: {
        activity: 4201,
        avatar: 4202,
        email: 4203,
        keys: 4204,
        replay: 4205,
        session: 4206,
        user: 4207,
        verification: 4208,
      },
    },
    databaseURL: 'postgresql://quarry:secret@127.0.0.1:4300/vers',
    developmentEnvText: 'PORT=3002\nSERVICE_AUTH_JWKS=dev-jwks\nFEATURE_GLOW=on\n',
    stackEnvText: 'SERVICE_AUTH_JWKS=stack-jwks\n',
  });

  expect(env).toStrictEqual({
    FEATURE_GLOW: 'on',
    SERVICE_AUTH_JWKS: 'stack-jwks',
    ACTIVITY_SERVICE_URL: 'http://127.0.0.1:4201',
    AVATAR_SERVICE_URL: 'http://127.0.0.1:4202',
    EMAIL_SERVICE_URL: 'http://127.0.0.1:4203',
    KEYS_SERVICE_URL: 'http://127.0.0.1:4204',
    REPLAY_SERVICE_URL: 'http://127.0.0.1:4205',
    SESSION_SERVICE_URL: 'http://127.0.0.1:4206',
    USER_SERVICE_URL: 'http://127.0.0.1:4207',
    VERIFICATION_SERVICE_URL: 'http://127.0.0.1:4208',
    NODE_ENV: 'development',
    HOSTNAME: '127.0.0.1',
    PORT: '4202',
    DATABASE_URL: 'postgresql://quarry:secret@127.0.0.1:4300/vers',
    LOG_LEVEL: 'warn',
    RESEND_API_KEY: 'stub-key',
    RESEND_BASE_URL: 'http://127.0.0.1:4101',
    SIM_ENGINE_HASH: 'verify-local',
  });
});

test('#buildWebEnv serves the production build on the web port, with every service and the stubs', () => {
  const env = buildWebEnv({
    ports: {
      web: 5100,
      resend: 5101,
      umami: 5102,
      services: {
        activity: 5201,
        avatar: 5202,
        email: 5203,
        keys: 5204,
        replay: 5205,
        session: 5206,
        user: 5207,
        verification: 5208,
      },
    },
    stackEnvText: 'SERVICE_AUTH_JWKS=stack-jwks\n',
  });

  expect(env).toStrictEqual({
    SERVICE_AUTH_JWKS: 'stack-jwks',
    ACTIVITY_SERVICE_URL: 'http://127.0.0.1:5201',
    AVATAR_SERVICE_URL: 'http://127.0.0.1:5202',
    EMAIL_SERVICE_URL: 'http://127.0.0.1:5203',
    KEYS_SERVICE_URL: 'http://127.0.0.1:5204',
    REPLAY_SERVICE_URL: 'http://127.0.0.1:5205',
    SESSION_SERVICE_URL: 'http://127.0.0.1:5206',
    USER_SERVICE_URL: 'http://127.0.0.1:5207',
    VERIFICATION_SERVICE_URL: 'http://127.0.0.1:5208',
    NODE_ENV: 'production',
    LOGGING: 'warn',
    PORT: '5100',
    SESSION_SECRET: 'e2e-session-secret-32-characters',
    UMAMI_URL: 'http://127.0.0.1:5102',
  });
});
