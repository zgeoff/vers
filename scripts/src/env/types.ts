export interface EnvFileManifestEntry {
  readonly itemTitle: string;
  readonly vault: 'vers';
  readonly targetPath: string;
}

export interface EnvWritePlan {
  readonly itemTitle: string;
  readonly vault: string;
  readonly filePath: string;
}
