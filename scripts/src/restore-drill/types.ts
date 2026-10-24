type RestoreDrillArea =
  | 'chain-anchors'
  | 'item-identities'
  | 'retained-sim-versions'
  | 'sessions'
  | 'verified-progress';

export interface RestoreDrillCheck {
  readonly area: RestoreDrillArea;
  readonly name: string;
  readonly violations: ReadonlyArray<string>;
}
