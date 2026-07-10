import { createTunnel } from './create-tunnel';

/**
 * The sanctioned scene → DOM channel: scene code renders into `sceneTunnel.In`, and the game
 * layout renders `sceneTunnel.Out` wherever that content belongs in the DOM tree.
 */
export const sceneTunnel = createTunnel();
