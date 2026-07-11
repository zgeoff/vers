import { CheckboxField } from './checkbox-field';

export function Default() {
  return (
    <CheckboxField
      checkboxProps={{
        id: 'remember-me',
      }}
      errors={[]}
      labelProps={{
        children: 'Remember me',
      }}
    />
  );
}
