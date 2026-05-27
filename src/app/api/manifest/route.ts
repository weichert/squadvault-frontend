import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type LeagueManifest = { name: string; canonical_id: string; seal_png_url: string | null };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  if (!leagueId) {
    return NextResponse.json(
      { name: 'SquadVault', short_name: 'SquadVault', description: "Your league's permanent record.",
        start_url: '/', display: 'standalone', background_color: '#0B0B0E', theme_color: '#C9A84C',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] },
      { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } }
    );
  }
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from('leagues')
      .select('name, canonical_id, seal_png_url').eq('canonical_id', leagueId).maybeSingle();
    const league = data as LeagueManifest | null;
    if (!league) return new NextResponse('Not found', { status: 404 });
    const sealBase = league.seal_png_url ?? '/icons/icon';
    return NextResponse.json(
      { name: `${league.name} Clubhouse`, short_name: league.name,
        description: `The official Clubhouse for ${league.name}.`,
        start_url: `/league/${league.canonical_id}`, display: 'standalone',
        background_color: '#0B0B0E', theme_color: '#C9A84C',
        scope: `/league/${league.canonical_id}/`,
        icons: [{ src: `${sealBase}-192.png`, sizes: '192x192', type: 'image/png' },
                { src: `${sealBase}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
        shortcuts: [
          { name: 'Archive', url: `/league/${league.canonical_id}/recaps`, description: 'Browse the record' },
          { name: 'Hall of Fame', url: `/league/${league.canonical_id}/hall-of-fame`, description: 'Championship history' }
        ] },
      { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch {
    return new NextResponse('Internal server error', { status: 500 });
  }
}
