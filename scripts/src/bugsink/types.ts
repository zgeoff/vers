export interface FlyMachine {
  readonly id: string;
  readonly state: string;
}

export interface MachineFleet {
  readonly list: () => Promise<ReadonlyArray<FlyMachine>>;
  readonly start: (id: string) => Promise<void>;
}
