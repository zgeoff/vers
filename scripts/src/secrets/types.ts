export interface OPReference {
  readonly field: string;
  readonly item: string;
  readonly vault: string;
}

export interface CollectedOPReferences {
  readonly references: ReadonlyArray<OPReference>;
  readonly unparsed: ReadonlyArray<string>;
}

export interface OPReferenceSource {
  readonly path: string;
  readonly references: ReadonlyArray<OPReference>;
}

export interface SecretsManifest {
  readonly vaults: ReadonlyMap<string, ReadonlyMap<string, ReadonlyArray<string>>>;
}

export interface UnlistedOPReference {
  readonly path: string;
  readonly reference: OPReference;
}

export interface SecretsManifestGaps {
  readonly unlisted: ReadonlyArray<UnlistedOPReference>;
  readonly unread: ReadonlyArray<OPReference>;
}
