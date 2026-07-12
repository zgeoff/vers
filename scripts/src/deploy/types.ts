export interface DeployManifest {
  readonly apps: ReadonlyArray<DeployTarget>;
}

export interface DeployTarget {
  readonly app: string;
  readonly configDir: string;
  readonly dockerfile?: string;
  readonly trigger: DeployTrigger;
  readonly minStartedMachines?: number;
  readonly buildArgsFromEnv?: ReadonlyArray<string>;
  readonly probes?: ReadonlyArray<Probe>;
  readonly scheduledMachines?: ReadonlyArray<ScheduledMachine>;
}

/**
 * A `fly machine run --schedule` machine the deploy CLI reconciles on every
 * deploy of its app — created at the fleet's default sizing (shared-cpu-1x,
 * 256MB) when absent, and moved onto the app's just-deployed image when it
 * drifts.
 */
export interface ScheduledMachine {
  readonly name: string;
  readonly command: ReadonlyArray<string>;
  readonly schedule: 'hourly' | 'daily' | 'weekly' | 'monthly';
  readonly region?: string;
}

export type DeployTrigger =
  | { readonly kind: 'turbo-affected'; readonly pkg: string }
  | { readonly kind: 'paths'; readonly globs: ReadonlyArray<string> };

export type Probe = HTTPProbe | JSONPostProbe;

interface HTTPProbe {
  readonly kind: 'http';
  readonly url: string;
  readonly expectStatus: number;
}

interface JSONPostProbe {
  readonly kind: 'json-post';
  readonly url: string;
  readonly body: unknown;
  readonly expect: (body: unknown) => boolean;
}

export interface AppState {
  readonly machines: ReadonlyArray<AppMachine>;
  readonly scheduledMachines: ReadonlyArray<ScheduledMachineState>;
  readonly deployedSHA: string | null;
  readonly serviceImage: string | null;
}

export interface AppMachine {
  readonly id: string;
  readonly state: string;
  readonly gitSHA: string | null;
}

/**
 * A scheduled machine as it currently exists on Fly, keyed by name for
 * matching against the manifest's declarations.
 */
export interface ScheduledMachineState {
  readonly id: string;
  readonly name: string;
  readonly image: string;
}

export type ScheduledMachineAction =
  | { readonly kind: 'create'; readonly machine: ScheduledMachine; readonly image: string }
  | { readonly kind: 'update-image'; readonly machineID: string; readonly image: string };

export interface ChangeSet {
  readonly affectedPkgs: ReadonlyArray<string>;
  readonly changedPaths: ReadonlyArray<string>;
}
