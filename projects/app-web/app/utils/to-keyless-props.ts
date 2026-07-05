/**
 * Strips the `key` entry that `@conform-to/react`'s `getInputProps`/`getFieldProps`
 * include in their return value.
 *
 * That `key` is only meaningful when the props are spread directly onto a JSX
 * element in a list; once it's nested inside a plain props object (e.g. an
 * `inputProps` prop) it's a stray field with a `string | undefined` type that
 * conflicts with `exactOptionalPropertyTypes`.
 *
 * ref: https://github.com/edmundhung/conform/issues/620
 */
export function toKeylessProps<T extends Record<string, unknown>>(props: T): Omit<T, 'key'> {
  const { key: _key, ...rest } = props;

  return rest;
}
