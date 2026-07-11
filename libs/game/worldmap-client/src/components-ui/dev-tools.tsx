import { CheckboxField } from '@vers/design-system';
import { toggleAxesHelper } from '../state/toggle-axes-helper';
import { toggleDevCamera } from '../state/toggle-dev-camera';
import { useIsAxesHelperVisible } from '../state/use-is-axes-helper-visible';
import { useIsDevCameraActive } from '../state/use-is-dev-camera-active';
import * as styles from './dev-tools.styles';

export function DevTools() {
  const isDevCameraActive = useIsDevCameraActive();
  const isAxesHelperVisible = useIsAxesHelperVisible();

  return (
    <div className={styles.container}>
      <CheckboxField
        checkboxProps={{
          checked: isDevCameraActive,
          onClick: toggleDevCamera,
        }}
        errors={[]}
        labelProps={{ children: 'Dev Camera' }}
      />
      <CheckboxField
        checkboxProps={{
          checked: isAxesHelperVisible,
          onClick: toggleAxesHelper,
        }}
        errors={[]}
        labelProps={{ children: 'Axes Helper' }}
      />
    </div>
  );
}
