import { ServiceID } from '@vers/service-types';

const SERVICE_IDS = Object.values(ServiceID);

export function parseServiceArg(value: string): ServiceID {
  if (SERVICE_IDS.includes(value as ServiceID)) {
    return value as ServiceID;
  }

  throw new Error(`Invalid service "${value}". Available services: ${SERVICE_IDS.join(', ')}`);
}
