// scripts/proof_w5_lifeline_name_format.ts
// Unit proof for the render-only name formatter (W.5 #13-23 display). formatPlayerName turns
// player_directory's canonical "Last, First" into "First Last" at the render layer (the seed/detail
// keep the canonical form). Pure function - no DB. Run: npx tsx scripts/proof_w5_lifeline_name_format.ts
import { formatPlayerName } from '../src/lib/trophy-room';

let failures = 0;
const eq = (label: string, got: string, want: string) => {
  if (got === want) console.log(`  OK   ${label}: "${got}"`);
  else { console.log(`  FAIL ${label}: got "${got}" want "${want}"`); failures++; }
};

// person, apostrophe, D/ST, suffix (first-comma split), no-comma fallback, trailing-comma guard.
eq('person', formatPlayerName('Vick, Michael'), 'Michael Vick');
eq('apostrophe', formatPlayerName('Bell, Le\'Veon'), 'Le\'Veon Bell');
eq('D/ST', formatPlayerName('Patriots, New England'), 'New England Patriots');
eq('suffix (first comma)', formatPlayerName('Beckham Jr., Odell'), 'Odell Beckham Jr.');
eq('no comma -> unchanged', formatPlayerName('Cher'), 'Cher');
eq('trailing comma -> last only', formatPlayerName('Lastonly,'), 'Lastonly');
// the four upgraded #23 skill winners (canonical -> rendered)
eq('#23 2014', formatPlayerName('Hopkins, DeAndre'), 'DeAndre Hopkins');
eq('#23 2018', formatPlayerName('Lindsay, Phillip'), 'Phillip Lindsay');
eq('#23 2019', formatPlayerName('Andrews, Mark'), 'Mark Andrews');
eq('#23 2022', formatPlayerName('Williams, Jamaal'), 'Jamaal Williams');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
