import { createStyleContext } from '../../utils/create-style-context';
import { tooltip } from './tooltip.styles';

const styleContext = createStyleContext(tooltip);

export const { withContext, withProvider } = styleContext;
