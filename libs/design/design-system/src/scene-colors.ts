/**
 * Colors for the three.js scene lane, which cannot consume Panda tokens: materials take raw
 * color values, so every 3D color lives here instead of inline in scene code. Values are
 * hand-derived from the semantic token palette and must move with any re-skin.
 */
export const sceneColors = {
  avatarPlaceholder: '#D8A56E',
  fogShroud: '#282d38',
  ground: '#3d424d',
  nodeBase: '#cbd5e1',
  nodeDimmed: '#475569',
  nodeSelected: '#7dd3fc',
  respiteBlock: '#8fa0c2',
  worldmapEdge: '#64748b',
} as const;
