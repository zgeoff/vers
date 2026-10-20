import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Resource } from '@opentelemetry/resources';

interface ReadTelemetryResourceOptions {
  readonly serviceName: string;
}

export function readTelemetryResource(options: ReadTelemetryResourceOptions): Resource {
  const flyImageRef = process.env['FLY_IMAGE_REF'];

  return resourceFromAttributes({
    'deployment.environment.name': process.env.NODE_ENV ?? 'development',
    'service.name': options.serviceName,
    ...(flyImageRef !== undefined && { 'service.version': flyImageRef }),
  });
}
