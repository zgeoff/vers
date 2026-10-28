import { preset } from '@vers/panda-preset';
import { buildSceneColors } from '../build-scene-colors';
import { formatSceneColorsModule } from '../format-scene-colors-module';

const sceneColors = buildSceneColors({
  semanticTokens: preset.theme?.extend?.semanticTokens?.colors,
  tokens: preset.theme?.extend?.tokens?.colors,
});

await Bun.write(
  new URL('../scene-colors.generated.ts', import.meta.url),
  formatSceneColorsModule(sceneColors),
);
