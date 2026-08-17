/**
 * Renders journal.template.html into journal.html by inlining every {{KEY}} image placeholder
 * as a base64 data URI. Run with `bun assemble.ts` from this directory. Each map entry is the
 * image stem inside images/; .png wins over .jpg when both exist. Fails loudly on a missing
 * image or an unresolved placeholder.
 */
const MAP: Record<string, string> = {
  ASSEMBLY: 'assembly-draft',
  L2_CODEX: 'lineup2-codex',
  L2_GATE: 'lineup2-gate',
  L2_STASH: 'lineup2-stash',
  R2_A: 'r2-sodium-terrace',
  R2_AC: 'r2-sodium-canyon',
  R2_AF: 'r2-sodium-quiet',
  R3_DUSK: 'r3-plaza-dusk',
  R3_NIGHT: 'r3-plaza-night',
  R4_DUSKFOG: 'r4-plaza-duskfog',
  R4_NIGHT: 'r4-plaza-night',
  R5_AVATAR: 'r5-lineup-avatar',
  R5_CODEX: 'r5-lineup-codex',
  R5_GATE: 'r5-lineup-gate',
  R5_MARKET: 'r5-lineup-market',
  R5_STASH: 'r5-lineup-stash',
  R7_ASSEMBLY: 'r7-assembly',
  R8_ASSEMBLY: 'r8-assembly',
  R8_CODEX: 'r8-lineup-codex',
  R9_ASSEMBLY: 'r9-assembly',
  R10_ASSEMBLY: 'r10-assembly',
  R10_PLAN: 'r10-plan',
  R11_ASSEMBLY: 'r11-assembly',
  R12_ASSEMBLY: 'r12-assembly',
  R12_ASSEMBLY_REF: 'r12-assembly',
  R13_DOME: 'r13-avatar-dome',
  R13_MARKET: 'r13-market-form',
  R15_ASSEMBLY: 'r15-assembly',
  R15_CODEX: 'r15-codex-form',
  R15_FOUNTAIN: 'r15-fountain-form',
  R15_GATE: 'r15-gate-form',
  R15_STASH: 'r15-stash-form',
  R16_ASSEMBLY: 'r16-assembly',
  R16_CODEX: 'r16-codex-form',
  R16_GATE: 'r16-gate-form',
  R16_STASH: 'r16-stash-form',
  R17_ASSEMBLY: 'r17-assembly',
  R17_ASSEMBLY_REF: 'r17-assembly',
  R18_GRADE: 'r18-grade',
  R18_GRADE_AO: 'r18-grade-ao',
  R18_GRADE_AO_REF: 'r18-grade-ao',
  R19_SURFACES: 'r19-surfaces',
  R20_CLADDING: 'r20-cladding',
  R20_CLADDING_CLOSE: 'r20-cladding-close',
  R21_RECIPES: 'r21-recipes',
  R21_RECIPES_CLOSE: 'r21-recipes-close',
  R22_TUNER: 'r22-tuner',
  R23_SPILL: 'r23-spill',
  R23_GATE_CLOSE: 'r23-gate-close',
  R23_MARKET_CLOSE: 'r23-market-close',
  R24_ATMO: 'r24-atmo',
  R24_GATE_HAZE: 'r24-gate-haze',
};

let html = await Bun.file(`${import.meta.dir}/journal.template.html`).text();

for (const [key, stem] of Object.entries(MAP)) {
  const png = Bun.file(`${import.meta.dir}/images/${stem}.png`);
  const jpg = Bun.file(`${import.meta.dir}/images/${stem}.jpg`);
  const usePNG = await png.exists();

  if (!usePNG && !(await jpg.exists())) {
    throw new Error(`missing image for ${key}: ${stem}`);
  }

  const file = usePNG ? png : jpg;
  const encoded = Buffer.from(await file.arrayBuffer()).toString('base64');
  const mime = usePNG ? 'image/png' : 'image/jpeg';

  html = html.replaceAll(`data:image/png;base64,{{${key}}}`, `data:${mime};base64,${encoded}`);
}

const leftover = html.match(/\{\{[A-Z0-9_]+\}\}/);

if (leftover) {
  throw new Error(`unresolved placeholder ${leftover[0]}`);
}

await Bun.write(`${import.meta.dir}/journal.html`, html);
console.log(`journal.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);
