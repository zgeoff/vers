import type { SimVersionRow, UpsertSimVersionInput } from '@vers/sim-registry';

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

  /**
   * Marks the target whose deploy the sim-version reconcile runs after —
   * provisioning a per-version provider app and upserting the `sim_versions`
   * registry row for the engine hash baked into its image.
   */
  readonly simVersionProvider?: boolean;
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
  readonly checks?: ReadonlyArray<MachineCheck>;
}

interface MachineCheck {
  readonly name: string;
  readonly status: string;
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

/**
 * The fully-resolved image every service machine in a fleet currently agrees
 * on — `repository` carries the registry host (`registry.fly.io/<repo>`).
 */
export interface FleetImage {
  readonly repository: string;
  readonly tag: string;
  readonly digest: string;
}

export interface SimVersionActionInput {
  readonly bunVersion: string;
  readonly engineHash: string;
  readonly fleetImage: FleetImage | null;
  readonly providerAppExists: boolean;
  readonly providerMachineExists: boolean;
  readonly registryRow: SimVersionRow | undefined;
}

/**
 * What already exists of a per-version provider app. `hasMachine` is false
 * whenever `exists` is — an app can outlive its machine (a partial provision
 * or a manual destroy), and a registry row must never point at one that has
 * nothing to wake.
 */
export interface ProviderAppState {
  readonly exists: boolean;
  readonly hasMachine: boolean;
}

export type SimVersionAction =
  | { readonly kind: 'create-provider-app'; readonly app: string }
  | { readonly kind: 'allocate-flycast-ip'; readonly app: string }
  | { readonly kind: 'run-provider-machine'; readonly app: string; readonly image: string }
  | { readonly kind: 'upsert-registry-row'; readonly input: UpsertSimVersionInput };
