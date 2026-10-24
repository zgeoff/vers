export interface NeonBranch {
  readonly id: string;
  readonly name: string;
}

export type MigrationRun =
  | { readonly kind: 'up-to-date' }
  | {
      readonly kind: 'migrated';
      readonly backupBranch: NeonBranch;
      readonly appliedMigrationNames: ReadonlyArray<string>;
    }
  | {
      readonly kind: 'migration-failed';
      readonly backupBranch: NeonBranch;
      readonly appliedMigrationNames: ReadonlyArray<string>;
      readonly error: unknown;
    };
