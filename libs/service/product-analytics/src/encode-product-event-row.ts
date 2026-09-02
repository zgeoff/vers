import type { ProductEventName, StampedProductEvent } from './types';

export interface ProductEventRow {
  readonly activity_id: string | null;
  readonly event_name: ProductEventName;
  readonly node_id: string | null;
  readonly session_id: string;
  readonly timestamp: string;
  readonly user_id: string;
}

export function encodeProductEventRow(event: StampedProductEvent): ProductEventRow {
  return {
    activity_id: 'activityID' in event.properties ? event.properties.activityID : null,
    event_name: event.name,
    node_id: 'nodeID' in event.properties ? event.properties.nodeID : null,
    session_id: event.sessionID,
    timestamp: event.timestamp.toISOString(),
    user_id: event.userID,
  };
}
