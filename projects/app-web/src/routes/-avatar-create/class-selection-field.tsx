import type { ClassID } from '@vers/data';
import { Class, classes } from '@vers/data';
import { Button, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

const CLASS_OPTIONS: ReadonlyArray<ClassID> = [Class.Brute, Class.Scoundrel, Class.Scholar];

interface ClassSelectionFieldProps {
  readonly error?: string | undefined;
  readonly onSelect: (classID: ClassID) => void;
  readonly selected: ClassID | undefined;
}

const optionsRow = css({ display: 'flex', gap: '2' });

export function ClassSelectionField(props: ClassSelectionFieldProps) {
  return (
    <fieldset>
      <legend>Choose your class</legend>
      <div className={optionsRow} role="radiogroup">
        {CLASS_OPTIONS.map((classID) => (
          <Button
            key={classID}
            aria-checked={props.selected === classID}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a styled button acting as one option in a custom radio group; a native <input type="radio"> can't carry this layout
            role="radio"
            tabIndex={0}
            type="button"
            variant={props.selected === classID ? 'primary' : 'default'}
            onClick={() => {
              props.onSelect(classID);
            }}
          >
            {classes[classID].name}
          </Button>
        ))}
      </div>
      {props.selected !== undefined && (
        <Text data-testid="class-selection-description">
          {classes[props.selected].description[0]}
        </Text>
      )}
      {props.error !== undefined && <Text role="alert">{props.error}</Text>}
    </fieldset>
  );
}
