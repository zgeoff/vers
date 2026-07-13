/**
 * The deep-readonly JSON value every jsonb column types as, via the codegen column overrides in
 * `.kysely-codegenrc.json`. Readonly because a row's jsonb payload is never mutated in place —
 * writes construct fresh values — and a mutable recursive union would force every function taking
 * a row to opt out of readonly-parameter linting. Plain mutable values remain assignable.
 */
export type Json = JsonArray | JsonObject | JsonPrimitive;

type JsonArray = ReadonlyArray<Json>;

interface JsonObject {
  readonly [key: string]: Json | undefined;
}

type JsonPrimitive = boolean | number | string | null;
