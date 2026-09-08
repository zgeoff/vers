export interface RequestSpan {
  readonly name: string;
  readonly path: string | null;
  readonly service: string;
  readonly statusCode: number | null;
  readonly traceID: string;
}

export interface FleetRequest {
  readonly route: string;
  readonly traceID: string;
}

export interface RouteCount {
  readonly count: number;
  readonly route: string;
}

export type ColdPathVerdict =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'active';
      readonly count: number;
      readonly routes: ReadonlyArray<RouteCount>;
    };

export type AutoStopMode = 'stop' | 'suspend';

export interface ColdPathAction {
  readonly app: string;
  readonly kind: AutoStopMode;
  readonly machineID: string;
}

export interface OpBackedCredential {
  readonly envName: string;
  readonly fieldLabels: ReadonlyArray<string>;
  readonly itemTitle: string;
  readonly vault: string;
}
