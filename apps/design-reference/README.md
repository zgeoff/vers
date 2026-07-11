# @vers/design-reference

Static host for the locked visual direction behind [#198](https://github.com/zgeoff/vers/issues/198)
(design language pass over the ark-based design system). The pages under `public/` were exported
from Claude Design and curated to final state — exploration/round pages were dropped so the site
reads as the reference, not the session that produced it. It is not part of the product.

Adjustments to the export:

- file names are kebab-cased, cross-links rewritten to match
- each page pins a dark canvas (`html` background + auto heights) and drops the export's canvas-mode
  meta — the runtime chrome expects a host app to supply theme and canvas, and renders a light
  background standalone
- exploration pages removed: direction rounds, tooltip direction board, market listing rounds

Decisions recorded only in a removed page (market listing rounds), preserved here: **locked in —
1d-style base-stat colours (armour white, barrier teal, muted labels) + the highlighted-value mod
lines.** Its two then-open questions (tooltip center icon vs top-left with copy/compare/codex
shortcuts, and the 1a vs 1c buy call) resolve in the locked tooltip system and market pages.

Layout:

- `public/index.html` is a hand-written index over the exported pages.
- `public/support.js` is the export's bundled runtime; the `.html` pages are self-contained canvases
  that load it relatively.
- `public/glyph-grammar.html` is not a Claude Design export — it's the hand-authored SVG asset
  system (glyph families, gear tier lines, archetype form languages). Its embedded contract block
  governs how new glyphs are generated; it needs no `support.js` and inlines everything.
- Deployed to Fly as `vers-design-reference` (`fly deploy` from this directory). Machines auto-stop
  and scale to zero when idle.

Local preview: `bun run dev` (serves `public/` on a local port).
