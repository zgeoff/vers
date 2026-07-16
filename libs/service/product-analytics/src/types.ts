/**
 * The registry of product-event names and the properties each carries. Every addition lands with
 * its row in the event registry table in `docs/architecture/analytics.md` in the same PR.
 */
export interface ProductEventPropertiesMap {
  readonly activity_completed: ActivityCompletedProperties;
  readonly activity_started: ActivityStartedProperties;
  readonly node_explored: NodeExploredProperties;
  readonly session_started: EmptyProperties;
}

interface ActivityCompletedProperties {
  readonly activityID: string;
}

interface ActivityStartedProperties {
  readonly activityID: string;
  readonly nodeID: string;
}

interface NodeExploredProperties {
  readonly nodeID: string;
}

type EmptyProperties = Record<never, never>;

export type ProductEventName = keyof ProductEventPropertiesMap;

/**
 * One product event as an emitting flow describes it — a name paired with exactly that name's
 * properties.
 */
export type ProductEvent = {
  [N in ProductEventName]: { readonly name: N; readonly properties: ProductEventPropertiesMap[N] };
}[ProductEventName];

/**
 * The identity and time context the server stamps onto an event before delivery. Identity comes
 * from the caller's validated session, never from the emitting client's payload.
 */
export interface ProductEventStamp {
  readonly sessionID: string;
  readonly timestamp: Date;
  readonly userID: string;
}

export type StampedProductEvent = ProductEvent & ProductEventStamp;
