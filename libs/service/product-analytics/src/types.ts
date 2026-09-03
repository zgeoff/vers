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

type EmptyProperties = Readonly<Record<string, never>>;

export type ProductEventName = keyof ProductEventPropertiesMap;

export type ProductEvent = {
  [N in ProductEventName]: { readonly name: N; readonly properties: ProductEventPropertiesMap[N] };
}[ProductEventName];

export interface ProductEventStamp {
  readonly sessionID: string;
  readonly timestamp: Date;
  readonly userID: string;
}

export type StampedProductEvent = ProductEvent & ProductEventStamp;
