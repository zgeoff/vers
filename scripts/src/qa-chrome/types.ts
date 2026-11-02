export type RouteFamily = 'inet' | 'inet6';

export interface SavedRoute {
  readonly dev: string;
  readonly dst: string;
  readonly family: RouteFamily;
  readonly gateway: string | null;
  readonly isOnlink: boolean;
  readonly metric: number | null;
  readonly prefsrc: string | null;
  readonly protocol: string | null;
  readonly scope: string | null;
}

export interface NetworkCut {
  readonly interfaceName: string;
  readonly routes: ReadonlyArray<SavedRoute>;
}

export interface ChromeNamespace {
  readonly cut: NetworkCut | null;
  readonly holderPID: number;
}

export interface ChromeState {
  readonly leaderPID: number;
  readonly leaderStartTime: string;
  readonly namespace: ChromeNamespace | null;
  readonly port: number;
}

export interface ChromePaths {
  readonly directory: string;
  readonly logFile: string;
  readonly profileDir: string;
  readonly stateFile: string;
}

export type ChromeRefusal =
  | { readonly kind: 'already-running'; readonly pid: number; readonly port: number }
  | { readonly kind: 'chromium-missing' }
  | { readonly kind: 'no-browser' }
  | { readonly kind: 'no-namespace' }
  | { readonly kind: 'pasta-missing' }
  | { readonly kind: 'port-busy'; readonly port: number }
  | { readonly kind: 'tmpdir-too-long'; readonly bytes: number; readonly limit: number };
