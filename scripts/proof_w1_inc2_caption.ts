// scripts/proof_w1_inc2_caption.ts
// W.1 Inc 2 acceptance proof — driven against the live caption route as a real franchise-linked
// member (headless-minted session; the L.1 precedent). Proves: NEGATIVE (no grant -> refused,
// nothing stored), POSITIVE (grant precedes caption; verbatim, attributed, append-only; renders
// in the distinct "As remembered by" panel), REVOCABLE-FORWARD (REVOKE withholds display, row
// intact). Scrubs all acceptance data at the end (service role) — the discharge basis is the
// observed pass, not persisted synthetic rows.
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsTransport = ws as any;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.PROOF_BASE ?? 'http://localhost:3939';

const EMAIL = 'swickywick@yahoo.com';
const MEMBER_ID = '279af3cd-2d32-42b1-a572-b3c3b3caf1b4';
const LEAGUE_ID = '00000000-0000-0000-0000-000000000001'; // UUID — consent/data layer
const LEAGUE_SLUG = '70985'; // canonical_id — the page URL slug (NOT the UUID; the member-keyed hazard)
const MEDIA_ENTRY_ID = '1bbd12ae-9b00-430d-835d-286076635144';
const CAPTION_BODY = 'W1I2-PROOF :: I remember this was the night we clinched at the buzzer.';

const svc = createClient(URL, SERVICE, { realtime: { transport: wsTransport } });

let failures = 0;
function ok(m: string) { console.log(`  OK   ${m}`); }
function bad(m: string) { console.log(`  FAIL ${m}`); failures++; }

async function mintMemberSession(): Promise<{ cookie: string; accessToken: string }> {
  const { data: link, error: linkErr } = await svc.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (linkErr || !link?.properties?.hashed_token) throw new Error('generateLink failed: ' + JSON.stringify(linkErr));
  const anon = createClient(URL, ANON, { realtime: { transport: wsTransport } });
  const { data: otp, error: otpErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (otpErr || !otp.session) throw new Error('verifyOtp failed: ' + JSON.stringify(otpErr));

  const jar = new Map<string, string>();
  const ssr = createServerClient(URL, ANON, {
    realtime: { transport: wsTransport },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: otp.session.access_token, refresh_token: otp.session.refresh_token });
  return {
    cookie: [...jar].map(([n, v]) => `${n}=${v}`).join('; '),
    accessToken: otp.session.access_token,
  };
}

async function captionCount(): Promise<number> {
  const { data } = await svc.from('media_captions').select('id').eq('media_entry_id', MEDIA_ENTRY_ID).eq('author_user_id', MEMBER_ID) as { data: { id: string }[] | null };
  return data?.length ?? 0;
}
async function currentGrant(): Promise<string | null> {
  const { data } = await svc.from('member_consent_current').select('current_state').eq('member_user_id', MEMBER_ID).eq('category', 'media_caption').maybeSingle() as { data: { current_state: string } | null };
  return data?.current_state ?? null;
}

async function main() {
  console.log('\n=== W.1 Inc 2 caption acceptance proof (member', EMAIL + ') ===');
  const { cookie, accessToken } = await mintMemberSession();
  const H = { 'Content-Type': 'application/json', Cookie: cookie };

  // Clean slate guard.
  if ((await captionCount()) !== 0) { bad('pre-state: a caption already exists for this member+item — aborting'); process.exit(1); }
  console.log('\n[1] NEGATIVE — no grant -> refused, nothing stored');
  const neg = await fetch(`${BASE}/api/av-room/caption`, { method: 'POST', headers: H, body: JSON.stringify({ mediaEntryId: MEDIA_ENTRY_ID, body: CAPTION_BODY }) });
  if (neg.status === 400) ok(`grantConsent omitted -> 400 (${(await neg.json()).error})`); else bad(`expected 400, got ${neg.status}`);
  const negFalse = await fetch(`${BASE}/api/av-room/caption`, { method: 'POST', headers: H, body: JSON.stringify({ mediaEntryId: MEDIA_ENTRY_ID, body: CAPTION_BODY, grantConsent: false }) });
  if (negFalse.status === 400) ok('grantConsent:false -> 400'); else bad(`expected 400, got ${negFalse.status}`);
  if ((await captionCount()) === 0) ok('no media_captions row created'); else bad('a caption was stored without a grant');
  if ((await currentGrant()) == null) ok('no media_caption grant recorded'); else bad('a grant was recorded by the refused attempt');

  console.log('\n[2] POSITIVE — grant precedes caption; verbatim, attributed, append-only');
  const pos = await fetch(`${BASE}/api/av-room/caption`, { method: 'POST', headers: H, body: JSON.stringify({ mediaEntryId: MEDIA_ENTRY_ID, body: CAPTION_BODY, grantConsent: true }) });
  const posJson = await pos.json();
  if (pos.status === 200 && posJson.ok) ok(`caption captured -> 200 (id ${posJson.captionId})`); else { bad(`expected 200, got ${pos.status}: ${JSON.stringify(posJson)}`); }
  // timestamps: GRANT precedes the caption row
  const { data: grantEv } = await svc.from('member_consent_events').select('recorded_at, event_type').eq('member_user_id', MEMBER_ID).eq('category', 'media_caption').eq('event_type', 'GRANT').order('recorded_at', { ascending: true }).limit(1).maybeSingle() as any;
  const { data: capRow } = await svc.from('media_captions').select('id, body, author_user_id, provenance, recorded_at, supersedes').eq('media_entry_id', MEDIA_ENTRY_ID).eq('author_user_id', MEMBER_ID).maybeSingle() as any;
  if (grantEv && capRow && grantEv.recorded_at <= capRow.recorded_at) ok(`GRANT (${grantEv.recorded_at}) precedes caption (${capRow.recorded_at})`); else bad('grant does not precede the caption in recorded_at');
  if (capRow?.body === CAPTION_BODY) ok('body stored VERBATIM'); else bad(`body not verbatim: ${JSON.stringify(capRow?.body)}`);
  if (capRow?.author_user_id === MEMBER_ID) ok('attributed to the member (author_user_id = the person)'); else bad('not attributed to the member');
  if (capRow?.provenance === 'MEMBER_CAPTION') ok('provenance = MEMBER_CAPTION (non-strippable stamp)'); else bad('provenance stamp wrong');

  console.log('\n[3] DISPLAY — renders in the distinct "As remembered by" panel, never the provenance panel');
  const pageGranted = await fetch(`${BASE}/league/${LEAGUE_SLUG}/av-room`, { headers: { Cookie: cookie } });
  const htmlG = await pageGranted.text();
  const hasBody = htmlG.includes(CAPTION_BODY);
  const hasPanel = htmlG.includes('As remembered by');
  if (hasBody && hasPanel) ok('caption body renders under the "As remembered by" panel'); else bad(`render check: body=${hasBody} panel=${hasPanel}`);
  // structural separation: the caption body must NOT sit inside the provenance <dl> (the FACT panel).
  // Heuristic: the body appears AFTER an "As remembered by" heading, and the provenance labels
  // (Contributed by / Season / Date) are not the container of the body.
  if (hasBody && htmlG.indexOf('As remembered by') < htmlG.indexOf(CAPTION_BODY)) ok('caption body is inside the remembered-account section (after its heading), not merged into provenance'); else bad('caption body not positioned within the remembered-account section');

  console.log('\n[4] REVOCABLE-FORWARD — member REVOKE withholds display; the captured row stays intact');
  // A GENUINE member act: the member's own authed client (Bearer = their session) inserts the
  // REVOKE. The RLS member-only INSERT (member_user_id = auth.uid()) is the hard guarantee that
  // this IS the member revoking their OWN grant — no service-role bypass, no proxy. (There is no
  // consent/events route for media_caption yet, same as L.1's oral_history_testimony; a member
  // revoke control is a thin display-adjacent follow-up — recorded in the close-out.)
  const memberClient = createClient(URL, ANON, {
    realtime: { transport: wsTransport },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { error: revErr } = await memberClient.from('member_consent_events').insert({
    member_user_id: MEMBER_ID, league_id: LEAGUE_ID, event_type: 'REVOKE', category: 'media_caption',
    rendering_class: null, context: 'av_room_caption', note: null,
  } as never);
  if (!revErr && (await currentGrant()) === 'REVOKE') ok('member-authored media_caption REVOKE recorded (current state = REVOKE)'); else bad(`REVOKE not recorded: ${JSON.stringify(revErr)}`);
  const pageRevoked = await fetch(`${BASE}/league/${LEAGUE_SLUG}/av-room`, { headers: { Cookie: cookie } });
  const htmlR = await pageRevoked.text();
  if (!htmlR.includes(CAPTION_BODY)) ok('caption is WITHHELD from display after REVOKE'); else bad('caption still displays after REVOKE');
  if ((await captionCount()) === 1) ok('the captured row stays INTACT (never rewritten/deleted)'); else bad('the captured row was altered by the REVOKE');

  console.log('\n[5] SCRUB — remove acceptance data (service role)');
  await svc.from('media_captions').delete().eq('media_entry_id', MEDIA_ENTRY_ID).eq('author_user_id', MEMBER_ID);
  await svc.from('member_consent_events').delete().eq('member_user_id', MEMBER_ID).eq('category', 'media_caption');
  const cleanCap = (await captionCount()) === 0;
  const cleanGrant = (await currentGrant()) == null;
  if (cleanCap && cleanGrant) ok('prod clean: no proof caption, no proof consent events remain'); else bad(`scrub incomplete: cap=${!cleanCap} grant=${await currentGrant()}`);

  console.log('\n=== Result:', failures === 0 ? 'ALL ACCEPTANCE CRITERIA MET' : `${failures} FAILURE(S)`, '===');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('proof error:', e); process.exit(1); });
