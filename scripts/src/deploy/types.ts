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
  readonly deployedSHA: string | null;
}

export interface AppMachine {
  readonly id: string;
  readonly state: string;
  readonly gitSHA: string | null;
}

export interface ChangeSet {
  readonly affectedPkgs: ReadonlyArray<string>;
  readonly changedPaths: ReadonlyArray<string>;
}
