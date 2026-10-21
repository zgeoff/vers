import { ServiceID } from '../types';

const SERVICE_IDS = Object.values(ServiceID);

const SERVICE_IDS_BY_VALUE = new Map<string, ServiceID>(SERVICE_IDS.map((id) => [id, id]));

export function parseServiceArg(value: string): ServiceID {
  const serviceID = SERVICE_IDS_BY_VALUE.get(value);

  if (serviceID !== undefined) {
    return serviceID;
  }

  throw new Error(`Invalid service "${value}". Available services: ${SERVICE_IDS.join(', ')}`);
}
