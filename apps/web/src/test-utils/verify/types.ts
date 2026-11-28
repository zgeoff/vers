// A workspace package, by its folder from the repo root, with the names of the workspace packages
// it depends on at run time.
export interface WorkspacePackage {
  readonly folder: string;
  readonly name: string;
  readonly workspaceDependencies: ReadonlyArray<string>;
}

// What a journey reaches beyond the core list: package folders, whose workspace dependencies it
// also reaches, and globs for the rest.
export interface FeatureReach {
  readonly packages: ReadonlyArray<string>;
  readonly paths: ReadonlyArray<string>;
}
