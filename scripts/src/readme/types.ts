/**
 * The structural subset of a zod schema the env-table renderer reads — duck-typed so schemas from
 * both zod majors in the workspace satisfy it without a zod dependency here.
 */
export interface EnvSchemaLike {
  readonly description?: string;
  readonly meta?: () => { readonly description?: string } | undefined;
  readonly safeParse: (value: unknown) => { readonly success: boolean; readonly data?: unknown };
}

export interface EnvRow {
  readonly defaultValue?: string | undefined;
  readonly description: string;
  readonly key: string;
  readonly required: boolean;
}
