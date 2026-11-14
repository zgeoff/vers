import { parseEnv } from 'node:util';
import type { StackPorts, StackServiceName } from './types';

export const stackServiceNames = [
  'activity',
  'avatar',
  'email',
  'keys',
  'replay',
  'session',
  'user',
  'verification',
] as const satisfies ReadonlyArray<StackServiceName>;

// the engine hash that the web build bakes in and the replay service serves, so a run that the
// browser plays replays on this tree's own engine
export const localEngineHash = 'verify-local';

interface ServiceEnvRequest {
  readonly service: StackServiceName;
  readonly ports: StackPorts;
  readonly databaseURL: string;
  readonly developmentEnvText: string;
  readonly stackEnvText: string;
}

// One service's environment: its committed dev env, with the e2e stack's single throwaway keypair
// in place of the dev keys, and every address pointed at this stack's own ports.
export function buildServiceEnv(request: ServiceEnvRequest): Record<string, string> {
  const development = parseEnv(request.developmentEnvText);
  const keys = parseEnv(request.stackEnvText);

  return {
    ...toDefinedEnv(development),
    ...toDefinedEnv(keys),
    ...buildServiceURLs(request.ports),
    NODE_ENV: 'development',
    HOSTNAME: '127.0.0.1',
    PORT: String(request.ports.services[request.service]),
    DATABASE_URL: request.databaseURL,
    LOG_LEVEL: 'warn',
    RESEND_API_KEY: 'stub-key',
    RESEND_BASE_URL: `http://127.0.0.1:${request.ports.resend}`,
    SIM_ENGINE_HASH: localEngineHash,
  };
}

interface WebEnvRequest {
  readonly ports: StackPorts;
  readonly stackEnvText: string;
}

// The web server's environment, as the e2e stack sets it. The live renderer stays on: only the
// world map it draws reveals nodes and caches their start inputs, so with it off no run can start.
export function buildWebEnv(request: WebEnvRequest): Record<string, string> {
  const keys = parseEnv(request.stackEnvText);

  return {
    ...toDefinedEnv(keys),
    ...buildServiceURLs(request.ports),
    NODE_ENV: 'production',
    LOGGING: 'warn',
    PORT: String(request.ports.web),
    SESSION_SECRET: 'e2e-session-secret-32-characters',
    UMAMI_URL: `http://127.0.0.1:${request.ports.umami}`,
  };
}

function buildServiceURLs(ports: StackPorts): Record<string, string> {
  return Object.fromEntries(
    stackServiceNames.map((service) => [
      `${service.toUpperCase()}_SERVICE_URL`,
      `http://127.0.0.1:${ports.services[service]}`,
    ]),
  );
}

function toDefinedEnv(
  parsed: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parsed).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}
