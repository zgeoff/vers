export interface EnvContract {
  readonly optional: ReadonlyArray<string>;
  readonly required: ReadonlyArray<string>;
}

export interface EnvGap {
  readonly label: string;
  readonly missing: ReadonlyArray<string>;
}

export interface EnvKeySource {
  readonly available: ReadonlySet<string>;
  readonly label: string;
}

export interface EnvFileManifestEntry {
  readonly itemTitle: string;
  readonly vault: 'vers' | 'vers-ci';
  readonly targetPath: string;
}

export interface EnvWritePlan {
  readonly itemTitle: string;
  readonly vault: string;
  readonly filePath: string;
}
