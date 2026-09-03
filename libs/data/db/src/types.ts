// readonly throughout: a mutable recursive union would force every function that takes a row to
// opt out of readonly-parameter linting, and plain mutable values stay assignable
export type Json = JsonArray | JsonObject | JsonPrimitive;

type JsonArray = ReadonlyArray<Json>;

interface JsonObject {
  readonly [key: string]: Json | undefined;
}

type JsonPrimitive = boolean | number | string | null;
