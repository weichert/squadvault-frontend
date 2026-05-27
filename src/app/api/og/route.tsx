import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const GOLD='#C9A84C', GOLD_DIM='#8B7035', BG='#0B0B0E', TEXT='#F0EBE1', TEXT2='#8A8478', TEXT3='#514D47';

type ArtifactOG = {
  artifact_type: string; trust_bar_text: string; docket_id: string | null;
  artifact_versions: { content_markdown: string; version: number }[];
  leagues: { name: string } | null;
};
type LeagueOG = { name: string; founding_year: number; canonical_id: string };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artifactId = searchParams.get('artifactId');
  const leagueId = searchParams.get('leagueId');
  try {
    const supabase = createAdminClient();
    if (artifactId) {
      const { data } = await supabase.from('artifacts')
        .select('artifact_type, trust_bar_text, docket_id, artifact_versions(content_markdown, version), leagues(name)')
        .eq('id', artifactId).maybeSingle();
      const artifact = data as ArtifactOG | null;
      if (!artifact) return new Response('Not found', { status: 404 });
      const versions = artifact.artifact_versions ?? [];
      const latest = [...versions].sort((a, b) => b.version - a.version)[0];
      const headline = latest?.content_markdown?.split('\n')[0]?.replace(/^#+ /, '')?.substring(0, 80) ?? artifact.artifact_type;
      const leagueName = artifact.leagues?.name ?? 'SquadVault';
      return new ImageResponse((
        <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:BG, border:`1px solid rgba(201,168,76,0.3)`, padding:'48px', fontFamily:'serif' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:40 }}>
            <div style={{ color:TEXT3, fontFamily:'monospace', fontSize:12, letterSpacing:'0.15em' }}>{leagueName.toUpperCase()}</div>
            <div style={{ color:TEXT3, fontFamily:'monospace', fontSize:12, letterSpacing:'0.15em' }}>SQUADVAULT</div>
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', color:TEXT, fontSize:headline.length>60?32:42, fontWeight:300, lineHeight:1.2, letterSpacing:'0.04em' }}>{headline}</div>
          <div style={{ borderTop:`1px solid ${GOLD_DIM}`, borderBottom:`1px solid ${GOLD_DIM}`, padding:'10px 0', textAlign:'center', color:GOLD, fontFamily:'monospace', fontSize:11, letterSpacing:'0.15em', marginTop:32, marginBottom:12 }}>{artifact.trust_bar_text}</div>
          <div style={{ color:GOLD_DIM, fontFamily:'monospace', fontSize:11, letterSpacing:'0.08em' }}>{artifact.docket_id ?? '—'}</div>
        </div>
      ), { width:1200, height:630 });
    }
    if (leagueId) {
      const { data } = await supabase.from('leagues')
        .select('name, founding_year, canonical_id').eq('canonical_id', leagueId).maybeSingle();
      const league = data as LeagueOG | null;
      if (!league) return new Response('Not found', { status: 404 });
      return new ImageResponse((
        <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:BG, border:`1px solid ${GOLD}`, fontFamily:'serif' }}>
          <div style={{ position:'absolute', inset:12, border:`1px solid rgba(139,112,53,0.25)`, borderRadius:2 }} />
          <div style={{ color:TEXT3, fontFamily:'monospace', fontSize:11, letterSpacing:'0.2em', marginBottom:24 }}>ESTABLISHED</div>
          <div style={{ color:TEXT, fontSize:72, fontWeight:300, letterSpacing:'0.04em', lineHeight:1.1, textAlign:'center', maxWidth:900 }}>{league.name}</div>
          <div style={{ color:TEXT2, fontSize:20, marginTop:16, fontStyle:'italic', letterSpacing:'0.04em' }}>Est. {league.founding_year}</div>
          <div style={{ width:40, height:1, background:'rgba(139,112,53,0.5)', marginTop:32, marginBottom:32 }} />
          <div style={{ color:TEXT3, fontFamily:'monospace', fontSize:11, letterSpacing:'0.15em' }}>SQUADVAULT · THE OFFICIAL CLUBHOUSE</div>
        </div>
      ), { width:1200, height:630 });
    }
    return new Response('leagueId or artifactId required', { status: 400 });
  } catch (err) {
    console.error('OG error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
