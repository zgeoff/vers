type Mutable<S> = { -readonly [K in keyof S]: S[K] };

export type SetEntityStateFn<S extends object> = (state: Mutable<S>) => void;
