import { parseEndpoint } from './parse-endpoint';

const DEFAULT_ENDPOINT = '127.0.0.1:9222';

export function resolveEndpoint(flag: string | undefined, envValue: string | undefined): string {
  if (flag !== undefined) {
    return flag;
  }

  if (envValue === undefined) {
    return DEFAULT_ENDPOINT;
  }

  try {
    return parseEndpoint(envValue);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(`QA_CDP_ENDPOINT is invalid: ${reason}`, { cause: error });
  }
}
