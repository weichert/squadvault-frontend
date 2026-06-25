// src/components/trophy-room/player-auction-awards.tsx
// W.5 display unit - the Player & Auction award cards (#13-23), Option A (player named on each card).
// Two all-time best-ever sections off season_award_winners: Positional Records (#13-18) and Auction &
// Acquisition (#19-23). Reuses RecordSection/TrophyCard (which renders the denormalized player name when
// present). Each section auto-omits when empty (silence over speculation - e.g. before the seed apply, or
// the auction four in seasons with no auction). No leaderboard - each card is one record + its lineage.
import { RecordSection } from './live-records';
import type { PlayerAuctionAwards as PlayerAuctionAwardsData } from '@/lib/trophy-room';

export function PlayerAuctionAwards({ awards }: { awards: PlayerAuctionAwardsData }) {
  return (
    <>
      <RecordSection title="Positional Records" records={awards.positional} />
      <RecordSection title="Auction & Acquisition" records={awards.auction} />
    </>
  );
}
