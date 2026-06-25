// scripts/proof_auth_callback_verifyotp.ts
// Bug B proof: the auth callback obtains a session via token_hash + verifyOtp (the
// SSR-correct, invite-capable, cross-device path), keeps the ?code= PKCE branch as a
// harmless fallback, and falls through cleanly (no throw -> safe redirect) when the link
// carries no usable credential. Pure branch-selection proof over a fake client - no DB,
// no server. Run: npx tsx scripts/proof_auth_callback_verifyotp.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/types';
import { resolveAuthSession } from '../src/lib/auth/callback';

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fail++; };

// A fake supabase client that records which auth method was called. Only the two methods
// resolveAuthSession touches are implemented; cast structurally for the proof.
type Calls = { verifyOtp: Array<{ type: string; token_hash: string }>; exchange: string[] };
function fakeClient(opts: {
  verifyUser?: { id: string; email: string | null } | null;
  verifyError?: boolean;
  exchangeUser?: { id: string; email: string | null } | null;
}): { client: SupabaseClient<Database>; calls: Calls } {
  const calls: Calls = { verifyOtp: [], exchange: [] };
  const client = {
    auth: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async verifyOtp(params: { type: string; token_hash: string }): Promise<any> {
        calls.verifyOtp.push(params);
        return {
          data: { user: opts.verifyUser ?? null, session: null },
          error: opts.verifyError ? { message: 'invalid token' } : null,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async exchangeCodeForSession(authCode: string): Promise<any> {
        calls.exchange.push(authCode);
        return {
          data: { session: opts.exchangeUser ? { user: opts.exchangeUser } : null },
          error: null,
        };
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

async function main() {
  console.log('\n=== Bug B: auth callback token_hash + verifyOtp ===');

  // 1. token_hash + type -> verifyOtp is the path; identity returned; code path untouched.
  {
    const { client, calls } = fakeClient({ verifyUser: { id: 'u-1', email: 'a@b.com' } });
    const r = await resolveAuthSession(client, { token_hash: 'TH', type: 'invite', code: null });
    ok(calls.verifyOtp.length === 1, 'verifyOtp called once for token_hash + type');
    ok(calls.verifyOtp[0]?.type === 'invite' && calls.verifyOtp[0]?.token_hash === 'TH', 'verifyOtp received {type, token_hash} verbatim');
    ok(calls.exchange.length === 0, 'exchangeCodeForSession NOT called when token_hash present');
    ok(r.userId === 'u-1' && r.userEmail === 'a@b.com', 'returns the verified user id + email');
  }

  // 2. token_hash present but type missing, no code -> nothing verified, no throw.
  {
    const { client, calls } = fakeClient({});
    const r = await resolveAuthSession(client, { token_hash: 'TH', type: null, code: null });
    ok(calls.verifyOtp.length === 0 && calls.exchange.length === 0, 'no auth call when type is missing');
    ok(r.userId === undefined && r.userEmail === undefined, 'returns empty -> route falls through to safe redirect');
  }

  // 3. neither credential -> empty, no throw (the old default-template fragment case).
  {
    const { client, calls } = fakeClient({});
    const r = await resolveAuthSession(client, { token_hash: null, type: null, code: null });
    ok(calls.verifyOtp.length === 0 && calls.exchange.length === 0, 'no auth call when no credential present');
    ok(r.userId === undefined, 'returns empty for a credential-less link (no throw)');
  }

  // 4. legacy ?code= only -> exchangeCodeForSession fallback still works.
  {
    const { client, calls } = fakeClient({ exchangeUser: { id: 'u-2', email: 'c@d.com' } });
    const r = await resolveAuthSession(client, { token_hash: null, type: null, code: 'PKCE' });
    ok(calls.exchange.length === 1 && calls.exchange[0] === 'PKCE', 'exchangeCodeForSession called for legacy ?code=');
    ok(calls.verifyOtp.length === 0, 'verifyOtp NOT called on the code path');
    ok(r.userId === 'u-2' && r.userEmail === 'c@d.com', 'returns the exchanged user id + email');
  }

  // 5. verifyOtp error -> empty, no throw (bad/expired link does not 500).
  {
    const { client } = fakeClient({ verifyError: true });
    const r = await resolveAuthSession(client, { token_hash: 'BAD', type: 'magiclink', code: null });
    ok(r.userId === undefined && r.userEmail === undefined, 'verifyOtp error returns empty (no throw)');
  }

  // 6. the open-redirect guard the route applies (mirrors route.ts) - relative kept, absolute dropped.
  {
    const safe = (r: string) => (r.startsWith('/') ? r : '/');
    ok(safe('/league/70985/consent') === '/league/70985/consent', 'relative redirect preserved');
    ok(safe('https://evil.example/steal') === '/', 'absolute redirect rejected -> /');
  }

  console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
