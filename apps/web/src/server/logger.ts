import { configureLogging, createOTLPLogSink } from '@vers/service-runtime/logging';
import { env } from './env';

export const logger = configureLogging({
  category: 'app-web',
  format: env.isProduction ? 'json' : 'pretty',
  level: env.LOGGING,
  ...(env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined && {
    sinks: [createOTLPLogSink({ serviceName: 'app-web' }).sink],
  }),
});
