/**
 * The two separately-rooted avatar roll-key populations: `'trade'` keys are held by the server,
 * `'self-found'` keys are held by the device. Each population derives from its own root secret, so
 * a key from one population never collides with or reveals a key from the other.
 */
export type Population = 'trade' | 'self-found';
