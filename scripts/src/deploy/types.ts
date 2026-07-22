import type { SimVersionRow, UpsertSimVersionInput } from '@vers/sim-registry';

export interface DeployManifest {
  readonly apps: ReadonlyArray<DeployTarget>;
}

type Exposure = 'public' | 'flycast';

export interface DeployTarget {
  readonly app: string;
  readonly configDir: string;
  readonly dockerfile?: string;
  readonly exposure: Exposure;
  readonly trigger: DeployTrigger;
  readonly minStartedMachines?: number;
  readonly buildArgsFromEnv?: ReadonlyArray<string>;
  readonly probes?: ReadonlyArray<Probe>;
  readonly scheduledMachines?: ReadonlyArray<ScheduledMachine>;

  /**
   * Marks the target whose deploy the sim-version reconcile runs after —
   * provisioning a per-version provider app and upserting the `sim_versions`
   * registry row for the engine hash baked into its image. `region` is the
   * Fly region a provider machine launches into.
   */
  readonly simVersionProvider?: { readonly region: string };
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
  readonly providerMachineID: string | null;
  readonly providerMachineImageDigest: string | null;
  readonly providerMachineRegion: string | null;
  readonly region: string;
  readonly registryRow: SimVersionRow | undefined;
}

/**
 * What already exists of a per-version provider app. `hasMachine` is false
 * whenever `exists` is — an app can outlive its machine (a partial provision
 * or a manual destroy), and a registry row must never point at one that has
 * nothing to wake. `machineID`/`machineImageDigest`/`machineRegion` are null
 * whenever `hasMachine` is.
 */
export interface ProviderAppState {
  readonly exists: boolean;
  readonly hasMachine: boolean;
  readonly machineID: string | null;
  readonly machineImageDigest: string | null;
  readonly machineRegion: string | null;
}

interface CreateProviderAppAction {
  readonly kind: 'create-provider-app';
  readonly app: string;
}

interface AllocateFlycastIPAction {
  readonly kind: 'allocate-flycast-ip';
  readonly app: string;
}

interface RunProviderMachineAction {
  readonly kind: 'run-provider-machine';
  readonly app: string;
  readonly image: string;
  readonly region: string;
}

/**
 * Replaces a provider machine whose image has drifted from the fleet's
 * resolved digest or whose region has drifted from the declared one —
 * `image` is always the fleet's tag ref, never its digest ref, matching
 * `RunProviderMachineAction`.
 */
interface ReplaceProviderMachineAction {
  readonly kind: 'replace-provider-machine';
  readonly app: string;
  readonly machineID: string;
  readonly image: string;
  readonly region: string;
}

interface UpsertRegistryRowAction {
  readonly kind: 'upsert-registry-row';
  readonly input: UpsertSimVersionInput;
}

export type SimVersionAction =
  | CreateProviderAppAction
  | AllocateFlycastIPAction
  | RunProviderMachineAction
  | ReplaceProviderMachineAction
  | UpsertRegistryRowAction;

/**
 * An IP address `flyctl ips list` reports for an app, narrowed to whether it's the private
 * flycast ingress or reachable from outside the mesh.
 */
export interface AppIP {
  readonly address: string;
  readonly type: 'private' | 'public';
}

export interface IPPostureEntry {
  readonly app: string;
  readonly exposure: Exposure;
  readonly ips: ReadonlyArray<AppIP>;
}

export type IPPostureAction = AllocateFlycastIPAction;

export interface IPPosturePlan {
  readonly actions: ReadonlyArray<IPPostureAction>;
  readonly violations: ReadonlyArray<string>;
}
