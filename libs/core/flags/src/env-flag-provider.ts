import type { JsonValue, Provider, ResolutionDetails } from '@openfeature/server-sdk';
import { ErrorCode, StandardResolutionReasons } from '@openfeature/server-sdk';
import { isFlagKey } from './is-flag-key';
import { toFlagEnvVar } from './to-flag-env-var';

export const envFlagProvider: Provider = {
  metadata: { name: 'env-flag-provider' },

  resolveBooleanEvaluation(flagKey, defaultValue): Promise<ResolutionDetails<boolean>> {
    if (!isFlagKey(flagKey)) {
      return Promise.resolve({
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: StandardResolutionReasons.ERROR,
        value: defaultValue,
      });
    }

    const envValue = process.env[toFlagEnvVar(flagKey)];

    if (envValue === 'true') {
      return Promise.resolve({ reason: StandardResolutionReasons.STATIC, value: true });
    }

    if (envValue === 'false') {
      return Promise.resolve({ reason: StandardResolutionReasons.STATIC, value: false });
    }

    if (envValue === undefined) {
      return Promise.resolve({ reason: StandardResolutionReasons.DEFAULT, value: defaultValue });
    }

    return Promise.resolve({
      errorCode: ErrorCode.PARSE_ERROR,
      errorMessage: `env var for flag "${flagKey}" is "${envValue}", expected "true" or "false"`,
      reason: StandardResolutionReasons.ERROR,
      value: defaultValue,
    });
  },

  resolveNumberEvaluation(_flagKey, defaultValue): Promise<ResolutionDetails<number>> {
    return Promise.resolve({ errorCode: ErrorCode.GENERAL, value: defaultValue });
  },

  resolveObjectEvaluation<T extends JsonValue>(
    _flagKey: string,
    defaultValue: T,
  ): Promise<ResolutionDetails<T>> {
    return Promise.resolve({ errorCode: ErrorCode.GENERAL, value: defaultValue });
  },

  resolveStringEvaluation(_flagKey, defaultValue): Promise<ResolutionDetails<string>> {
    return Promise.resolve({ errorCode: ErrorCode.GENERAL, value: defaultValue });
  },
};
