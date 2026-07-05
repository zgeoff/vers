import * as styles from './form-error-list.styles';

interface Props {
  errors?: Array<null | string | undefined> | null;
  id?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function FormErrorList(props: Props) {
  const errors = props.errors?.filter(Boolean) ?? [];

  if (errors.length === 0) {
    return null;
  }

  return (
    <ul {...props} className={styles.errorList}>
      {errors.map((error) => (
        <li key={error} className={styles.errorItem}>
          {error}
        </li>
      ))}
    </ul>
  );
}
