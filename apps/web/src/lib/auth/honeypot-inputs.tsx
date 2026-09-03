import { HONEYPOT_FIELD_NAME, HONEYPOT_VALID_FROM_FIELD_NAME } from './honeypot-field-names';

interface HoneypotInputsProps {
  readonly validFrom: string;
}

export function HoneypotInputs(props: Readonly<HoneypotInputsProps>) {
  return (
    <div aria-hidden="true" style={{ display: 'none' }}>
      <label htmlFor={HONEYPOT_FIELD_NAME}>Please leave this field blank</label>
      <input
        autoComplete="off"
        id={HONEYPOT_FIELD_NAME}
        name={HONEYPOT_FIELD_NAME}
        tabIndex={-1}
        type="text"
      />
      <input name={HONEYPOT_VALID_FROM_FIELD_NAME} type="hidden" value={props.validFrom} />
    </div>
  );
}
