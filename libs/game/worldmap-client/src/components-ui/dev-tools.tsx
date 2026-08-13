import { CheckboxField } from '@vers/design-system';
import { toggleAxesHelper } from '../state/toggle-axes-helper';
import { toggleDevCamera } from '../state/toggle-dev-camera';
import { toggleFogOfWar } from '../state/toggle-fog-of-war';
import { toggleScatter } from '../state/toggle-scatter';
import { useIsAxesHelperVisible } from '../state/use-is-axes-helper-visible';
import { useIsDevCameraActive } from '../state/use-is-dev-camera-active';
import { useIsFogOfWarVisible } from '../state/use-is-fog-of-war-visible';
import { useIsScatterVisible } from '../state/use-is-scatter-visible';
import * as styles from './dev-tools.styles';

export function DevTools() {
  const isDevCameraActive = useIsDevCameraActive();
  const isAxesHelperVisible = useIsAxesHelperVisible();
  const isFogOfWarVisible = useIsFogOfWarVisible();
  const isScatterVisible = useIsScatterVisible();

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
      <CheckboxField
        checkboxProps={{
          checked: isFogOfWarVisible,
          onClick: toggleFogOfWar,
        }}
        errors={[]}
        labelProps={{ children: 'Fog of War' }}
      />
      <CheckboxField
        checkboxProps={{
          checked: isScatterVisible,
          onClick: toggleScatter,
        }}
        errors={[]}
        labelProps={{ children: 'Scatter' }}
      />
    </div>
  );
}
