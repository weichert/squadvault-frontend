// scripts/proof_founders_seal.tsx
// Render proof for Trophy #31 The Founder's Seal. Verifies: silence when the entry is absent (null ->
// renders nothing) and that a seated entry renders the title, engraving, the ATTESTED (not canonical)
// trust label, and the attestation basis. Pure render - no DB. Run: npx tsx scripts/proof_founders_seal.tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { FoundersSeal } from '../src/components/trophy-room/founders-seal';

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fail++; };

// silence: absent entry renders nothing
const empty = renderToStaticMarkup(createElement(FoundersSeal, { seal: null }));
ok(empty === '', `silence when absent (got ${empty.length} chars)`);

// seated: title + engraving + ATTESTED label + basis
const html = renderToStaticMarkup(createElement(FoundersSeal, { seal: {
  title: "The Founder's Seal",
  description: 'PFL Buddies - founded 1984. All ten of its members have stood together ...',
  basis: 'Attested by David Stuart and Kent Paradis, 2026-06-21.',
} }));
ok(html.includes("The Founder&#x27;s Seal"), 'renders the title');
ok(html.includes('founded 1984'), 'renders the engraving');
ok(/Attested/.test(html) && /Not Canonical Data/.test(html), 'renders the ATTESTED / Not Canonical label');
ok(html.includes('David Stuart and Kent Paradis'), 'renders the attestation basis');
ok(!/CANONICAL[^ ]/.test(html.replace('Not Canonical', '')), 'does NOT claim canonical');

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
