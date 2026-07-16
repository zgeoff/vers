import type { StampedProductEvent } from './types';

/**
 * The wire row the Tinybird events data source ingests: snake_case columns matching the data
 * source schema, with each property column present on every row and `null` where the event doesn't
 * carry it — sparse typed columns, not a properties blob.
 */
export interface ProductEventRow {
  readonly activity_id: string | null;
  readonly event_name: string;
  readonly node_id: string | null;
  readonly session_id: string;
  readonly timestamp: string;
  readonly user_id: string;
}

/**
 * Encodes a stamped event into its data-source row: timestamps become ISO 8601 strings and every
 * property column is written explicitly so absent values land as `null`, never as a missing key
 * the ingest would default.
 */
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
