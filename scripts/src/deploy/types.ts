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

  readonly simVersionProvider?: { readonly region: string };
}

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
  readonly image: string | null;
  readonly checks?: ReadonlyArray<MachineCheck>;
}

interface MachineCheck {
  readonly name: string;
  readonly status: string;
}

export interface ScheduledMachineState {
  readonly id: string;
  readonly name: string;
  readonly image: string;
}

export interface MachineSweepTarget {
  readonly id: string;
  readonly image: string | null;
}

export type ScheduledMachineAction =
  | { readonly kind: 'create'; readonly machine: ScheduledMachine; readonly image: string }
  | { readonly kind: 'update-image'; readonly machineID: string; readonly image: string };

export interface ChangeSet {
  readonly affectedPkgs: ReadonlyArray<string>;
  readonly changedPaths: ReadonlyArray<string>;
}

export type CommitRelation = 'missing' | 'same' | 'ancestor' | 'descendant' | 'diverged';

export interface IgnorePattern {
  readonly glob: string;
  readonly negated: boolean;
}

export interface FleetImage {
  readonly repository: string;
  readonly tag: string;
  readonly digest: string;
}

export interface SimVersionActionInput {
  readonly bunVersion: string;
  readonly engineHash: string;
  readonly fleetImage: FleetImage | null;
  readonly maxContentVersion: string;
  readonly providerAppExists: boolean;
  readonly providerMachineExists: boolean;
  readonly providerMachineID: string | null;
  readonly providerMachineImageDigest: string | null;
  readonly providerMachineRegion: string | null;
  readonly region: string;
  readonly registryRow: SimVersionRow | undefined;
}

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
