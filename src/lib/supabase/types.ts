// src/lib/supabase/types.ts
// TypeScript types generated from the SquadVault Supabase schema
// Keep in sync with supabase/migrations/001_core_schema.sql

export type LeagueStatus = 'founding' | 'active' | 'archived';

export type VoiceProfileKey =
  | 'BALL_BUSTING_FRIENDS'
  | 'COMPETITIVE_SERIOUS'
  | 'NOSTALGIC_HISTORIANS'
  | 'CASUAL_SOCIAL'
  | 'MIXED';

export type ApprovalState =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'WITHHELD'
  | 'DISTRIBUTED';

export type ArtifactType =
  | 'WEEKLY_RECAP'
  | 'FOUNDING'
  | 'TROPHY_CARD'
  | 'RIVALRY_CHRONICLE'
  | 'SEASON_RETROSPECTIVE';

export type ArtifactClass = 'E1' | 'E2' | 'A1' | 'A2' | 'A3' | 'F1' | 'FOUNDING';

export type TrophyProvenance = 'CANONICAL' | 'COMMISSIONER_ATTESTED' | 'DEMO';

export type TrophyEntryType =
  | 'CHAMPIONSHIP'
  | 'PHYSICAL_TROPHY'
  | 'COMMISSIONER_ATTESTED'
  | 'SHAME_RECORD';

export type FrictionStage =
  | 'intake'
  | 'founding'
  | 'record_entry'
  | 'approval'
  | 'distribution'
  | 'reception';

export type FrictionSeverity = 'low' | 'medium' | 'high';

export type FoundingSessionState =
  | 'IN_PROGRESS'
  | 'CONSENT_COLLECTION'
  | 'OUTPUT_GENERATION'
  | 'COMPLETE';

// ── Trust bar canonical strings ─────────────────────────────────────────
export const TRUST_BAR = {
  CERTIFIED:  'Entered into the Record · Source Facts Verified · SquadVault',
  DEMO:       'Demo Artifact · Example Record · SquadVault',
  ATTESTED:   'Commissioner Attested · Not Canonical Data · SquadVault',
  DRAFT:      'Draft Preview · Pending Commissioner Review · SquadVault',
} as const;

export type TrustBarVariant = keyof typeof TRUST_BAR;

// ── Database row types ───────────────────────────────────────────────────
export interface OfficeBrief {
  theme: string;
  voice_calibration: VoiceProfileKey;
  physical_artifact: string | null;
  founding_plaque: string;
  notes: string[];
}

export interface League {
  id: string;
  canonical_id: string;
  name: string;
  founding_year: number;
  commissioner_email: string | null;
  commissioner_user_id: string | null;
  voice_profile_id: string | null;
  status: LeagueStatus;
  seal_svg_url: string | null;
  seal_png_url: string | null;
  first_approval_completed: boolean;
  oral_history_eligible: boolean;
  office_brief?: OfficeBrief | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfile {
  id: string;
  league_id: string;
  version: number;
  profile_key: VoiceProfileKey;
  prose: string;
  authored_by: string;
  governance_memo_ref: string | null;
  active: boolean;
  created_at: string;
}

export interface Franchise {
  id: string;
  league_id: string;
  canonical_franchise_id: string;
  owner_display_name: string;
  member_user_id: string | null;
  is_commissioner: boolean;
  charter_member: boolean;
  seasons_active: number[];
  created_at: string;
}

// Season-scoped team name (migration 009). One row per (franchise slot,
// season): the team name AS IT EXISTED that season, for era-correct
// attribution where a slot's ownership turned over.
export interface FranchiseSeasonName {
  id: string;
  league_id: string;
  canonical_franchise_id: string;
  season: number;
  team_name: string;
  created_at: string;
}

// Per-franchise, per-season record board facts (migration 008). One row per
// (franchise slot, season): W-L-T and points-for, plus the exactly-provable
// playoff result tier. result is '' | 'CHAMPION' | 'RUNNER_UP' ('' = no title;
// matches the DB CHECK). No final rank: never ingested, not exactly derivable,
// omitted per silence-over-speculation. franchise_id is the UUID FK to
// franchises.id (the era-name join hops uuid -> canonical_franchise_id).
export interface FranchiseSeasonRecord {
  id: string;
  league_id: string;
  franchise_id: string;
  season: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  result: '' | 'CHAMPION' | 'RUNNER_UP';
  provenance: string;
  created_at: string;
}

export interface Artifact {
  id: string;
  league_id: string;
  artifact_type: ArtifactType;
  artifact_class: ArtifactClass;
  season: number | null;
  week_index: number | null;
  engine_artifact_id: string | null;
  engine_source_hash: string | null;
  approval_state: ApprovalState;
  current_version: number;
  is_demo: boolean;
  docket_id: string | null;
  trust_bar_text: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  distributed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersion {
  id: string;
  artifact_id: string;
  version: number;
  content_markdown: string;
  facts_json: Record<string, unknown> | null;
  generated_by: string;
  changes_requested_note: string | null;
  created_at: string;
}

export interface ApprovalEvent {
  id: string;
  artifact_id: string;
  from_state: ApprovalState;
  to_state: ApprovalState;
  actor_user_id: string;
  note: string | null;
  created_at: string;
}

export interface DocketId {
  id: string;
  artifact_id: string;
  docket_value: string;
  year: number;
  sequence_number: number;
  is_demo: boolean;
  created_at: string;
}

export interface TrophyRoomEntry {
  id: string;
  league_id: string;
  entry_type: TrophyEntryType;
  season: number | null;
  franchise_id: string | null;
  title: string;
  description: string | null;
  provenance: TrophyProvenance;
  image_url: string | null;
  commissioner_note: string | null;
  created_at: string;
}

export interface FoundingSession {
  id: string;
  league_id: string;
  commissioner_user_id: string;
  state: FoundingSessionState;
  exchanges: SessionExchange[];
  covered_topics: string[];
  pending_required_topics: string[];
  consent: ConsentRecord;
  voice_profile_selection: VoiceProfileKey | null;
  total_tokens_used: number;
  outputs_generated: boolean;
  outputs_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionExchange {
  turn: number;
  role: 'agent' | 'commissioner';
  content: string;
  intent_classified: string | null;
  created_at: string;
}

export interface ConsentRecord {
  photos: 'OPT_IN' | 'OPT_OUT' | null;
  voice_recording: 'OPT_IN' | 'OPT_OUT' | null;
  text_likeness: 'OPT_IN' | 'OPT_OUT' | null;
}

// W.6 Consent Governance Memo v1.2 (ratified 2026-06-10) — per-member consent
// system of record (migration 010). NOTE: distinct from ConsentRecord above,
// which is the league-defaults layer on founding_sessions.consent (D-X).
export type MemberConsentCategory =
  | 'media_appearance'
  | 'recorded_voice'
  | 'likeness_derived'
  | 'attributed_quotes'
  | 'synthesized_voice'
  // L.3 The Vault (migration 017, D-L3-4). Consent-at-writing for a sealed letter; carries
  // no rendering_class. The GRANT covers in-ceremony reveal only (republication is a
  // distinct future consent act, D-SEQ-6 held in-ceremony-only).
  | 'sealed_testimony';

export type MemberConsentEventType = 'GRANT' | 'REVOKE';

// Append-only event (D-T). rendering_class is required iff category is
// 'synthesized_voice' (D-S 2e); null for all other categories.
export interface MemberConsentEvent {
  id: string;
  member_user_id: string;
  league_id: string;
  event_type: MemberConsentEventType;
  category: MemberConsentCategory;
  rendering_class: string | null;
  context: string;
  note: string | null;
  recorded_at: string;
}

// Derived current state (the member_consent_current view, W.6 section 1.1).
// ABSENCE of a row for a (member, category[, class]) = ungranted
// (default-posture law, W.6 section 1.4) — consumers treat missing as no-grant.
export interface MemberConsentCurrent {
  member_user_id: string;
  league_id: string;
  category: MemberConsentCategory;
  rendering_class: string | null;
  current_state: MemberConsentEventType;
  recorded_at: string;
}

// W.1 A/V Room (four-memo chain, ratified 2026-06-10; migration 011). Four
// append-only classes; Increment 1 writes are all commissioner-authored.
export type MediaKind = 'photo' | 'video';

export type MediaProvenanceTagKind =
  | 'contributor'
  | 'date'
  | 'season'
  | 'event'
  | 'member_identification';

export type MediaDatePrecision = 'exact' | 'year' | 'season';

// One ingested photo/video (spec 5.2). storage_path is the object key in the
// private league-media bucket; bytes are served only via server-issued signed URLs.
export interface MediaEntry {
  id: string;
  league_id: string;
  media_kind: MediaKind;
  storage_path: string;
  mime_type: string;
  uploaded_by: string;
  upload_note: string | null;
  created_at: string;
  // R4-D3 (migration 013): sha256 hex byte-identity for duplicate detection. A
  // CONVENIENCE, not provenance; nullable and optional (older rows + pre-backfill rows
  // read absent). Present in the type ahead of the column so the typed client compiles.
  content_hash?: string | null;
}

// Append-only provenance event (spec 5.3). Current tag state for an item =
// latest non-superseded, non-withdrawn event per tag_kind; absence = unknown
// (rendered as an honest gap). date_precision is set iff tag_kind is 'date';
// tagged_member_user_id is set iff tag_kind is 'member_identification'.
export interface MediaProvenanceTagEvent {
  id: string;
  media_entry_id: string;
  tag_kind: MediaProvenanceTagKind;
  tag_value: string | null;
  date_precision: MediaDatePrecision | null;
  tagged_member_user_id: string | null;
  ratified_by: string;
  note: string | null;
  recorded_at: string;
  supersedes: string | null;
}

// The fail-closed gate (spec 5.4): the display route renders nothing for a
// league until a row exists here. Append-only; re-ratification is a new row.
export interface RoomRatificationEvent {
  id: string;
  league_id: string;
  ratified_by: string;
  scope_note: string | null;
  recorded_at: string;
}

// Display withdrawal (spec 5.5; W.1 mints it, later units reuse it).
// media_entry_id is nullable for Increment 2 testimony reuse; league_id is
// carried explicitly so RLS league-scoping holds when media_entry_id is null.
export interface MediaDisplayWithdrawal {
  id: string;
  league_id: string;
  media_entry_id: string | null;
  requested_by: string;
  ratified_by: string | null;
  note: string | null;
  recorded_at: string;
}

// Reinstatement of a withdrawn item (spec 5.5 / D5). Append-only sibling of the
// withdrawal: a new event that reverses a specific prior withdrawal. The read-model
// treats an item as withdrawn iff its latest withdrawal postdates its latest
// reinstatement. media_entry_id nullable (Increment 2 reuse); league_id explicit
// for RLS; withdrawal_id names the withdrawal being reversed.
export interface MediaDisplayReinstatement {
  id: string;
  league_id: string;
  media_entry_id: string | null;
  withdrawal_id: string;
  reinstated_by: string;
  note: string | null;
  recorded_at: string;
}

// D-W1-E1 (migration 014): the append-only expungement event - the license to delete a
// media item's stored bytes. Terminal; reason required.
export interface MediaExpungementEvent {
  id: string;
  league_id: string;
  media_entry_id: string;
  reason: string;
  expunged_by: string;
  recorded_at: string;
}

// D-W1-A (migration 015): the append-only voice-attestation event - a commissioner's
// claim about whether a video contains a member's voice. The playback gate reads the
// LATEST event per entry.
export interface MediaVoiceAttestation {
  id: string;
  league_id: string;
  media_entry_id: string;
  attested_state: 'no_member_voice' | 'member_voice_present';
  attested_by: string;
  note: string | null;
  recorded_at: string;
}

// E2.3-minimal (migration 016): the append-only member<->franchise linkage event -
// the commissioner's ratification binding an invited member_user_id to a franchise.
// The latest event per franchise is the current linkage; franchises.member_user_id is
// the derived pointer the invite route maintains for existing readers.
export interface FranchiseMemberLink {
  id: string;
  league_id: string;
  franchise_id: string;
  member_user_id: string;
  linked_by: string;
  note: string | null;
  recorded_at: string;
}

// L.3 The Vault (migration 018): the sealed-letter fact class. Two-table seal split -
// vault_sealed_letters holds the readable METADATA (existence + sealed_at); the body lives
// in vault_sealed_letter_bodies behind NO read policy (the seal). Append-only; a SEAL is
// terminal and a correction is a NEW letter.
export interface VaultSealedLetter {
  id: string;
  league_id: string;
  member_user_id: string;
  franchise_id: string;
  season: number;
  sealed_at: string;
  recorded_at: string;
}

// The sealed body. No SELECT policy exists on this table pre-reveal: no role - author,
// commissioner, admin - can read it. Insert-only (author of the parent letter).
export interface VaultSealedLetterBody {
  letter_id: string;
  body: string;
}

export interface CommissionerNote {
  id: string;
  artifact_id: string;
  league_id: string;
  content: string;
  authored_by: string;
  created_at: string;
}

export interface SyncLog {
  id: string;
  engine_git_hash: string | null;
  tables_synced: Record<string, number>;
  row_counts: Record<string, number>;
  status: 'success' | 'partial' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  league_id: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address_hash: string | null;
  user_agent_hash: string | null;
  created_at: string;
}

// ── Supabase Database type (for createClient<Database>()) ────────────────
export type Database = {
  public: {
    Tables: {
      leagues:           { Row: League;          Insert: Omit<League, 'id' | 'created_at' | 'updated_at'>; Update: Partial<League> };
      voice_profiles:    { Row: VoiceProfile;    Insert: Omit<VoiceProfile, 'id' | 'created_at'>; Update: Partial<VoiceProfile> };
      franchises:        { Row: Franchise;       Insert: Omit<Franchise, 'id' | 'created_at'>; Update: Partial<Franchise> };
      franchise_season_names: { Row: FranchiseSeasonName; Insert: Omit<FranchiseSeasonName, 'id' | 'created_at'>; Update: Partial<FranchiseSeasonName> };
      franchise_season_records: { Row: FranchiseSeasonRecord; Insert: Omit<FranchiseSeasonRecord, 'id' | 'created_at'>; Update: Partial<FranchiseSeasonRecord> };
      artifacts:         { Row: Artifact;        Insert: Omit<Artifact, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Artifact> };
      artifact_versions: { Row: ArtifactVersion; Insert: Omit<ArtifactVersion, 'id' | 'created_at'>; Update: Partial<ArtifactVersion> };
      approval_events:   { Row: ApprovalEvent;   Insert: Omit<ApprovalEvent, 'id' | 'created_at'>; Update: never };
      docket_ids:        { Row: DocketId;        Insert: Omit<DocketId, 'id' | 'created_at'>; Update: never };
      trophy_room_entries: { Row: TrophyRoomEntry; Insert: Omit<TrophyRoomEntry, 'id' | 'created_at'>; Update: Partial<TrophyRoomEntry> };
      founding_sessions: { Row: FoundingSession; Insert: Omit<FoundingSession, 'id' | 'created_at' | 'updated_at'>; Update: Partial<FoundingSession> };
      commissioner_notes: { Row: CommissionerNote; Insert: Omit<CommissionerNote, 'id' | 'created_at'>; Update: never };
      sync_log:          { Row: SyncLog;         Insert: Omit<SyncLog, 'id' | 'created_at'>; Update: never };
      audit_log:         { Row: AuditLog;        Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: never };
      member_consent_events: { Row: MemberConsentEvent; Insert: Omit<MemberConsentEvent, 'id' | 'recorded_at'>; Update: never };
      media_entries:     { Row: MediaEntry;     Insert: Omit<MediaEntry, 'id' | 'created_at'>; Update: never };
      media_provenance_tag_events: { Row: MediaProvenanceTagEvent; Insert: Omit<MediaProvenanceTagEvent, 'id' | 'recorded_at'>; Update: never };
      room_ratification_events: { Row: RoomRatificationEvent; Insert: Omit<RoomRatificationEvent, 'id' | 'recorded_at'>; Update: never };
      media_display_withdrawals: { Row: MediaDisplayWithdrawal; Insert: Omit<MediaDisplayWithdrawal, 'id' | 'recorded_at'>; Update: never };
      media_display_reinstatements: { Row: MediaDisplayReinstatement; Insert: Omit<MediaDisplayReinstatement, 'id' | 'recorded_at'>; Update: never };
      media_expungement_events: { Row: MediaExpungementEvent; Insert: Omit<MediaExpungementEvent, 'id' | 'recorded_at'>; Update: never };
      media_voice_attestations: { Row: MediaVoiceAttestation; Insert: Omit<MediaVoiceAttestation, 'id' | 'recorded_at'>; Update: never };
      franchise_member_links: { Row: FranchiseMemberLink; Insert: Omit<FranchiseMemberLink, 'id' | 'recorded_at'>; Update: never };
      vault_sealed_letters: { Row: VaultSealedLetter; Insert: Omit<VaultSealedLetter, 'id' | 'sealed_at' | 'recorded_at'>; Update: never };
      vault_sealed_letter_bodies: { Row: VaultSealedLetterBody; Insert: VaultSealedLetterBody; Update: never };
    };
    Views: {
      member_consent_current: { Row: MemberConsentCurrent };
    };
    Functions: {
      get_user_league_id: { Args: Record<never, never>; Returns: string };
      is_commissioner:    { Args: { p_league_id: string }; Returns: boolean };
      is_admin:           { Args: Record<never, never>; Returns: boolean };
      // L.3 (migration 018): read-only seal-fails-closed introspection for G22. Returns
      // booleans about vault_sealed_letter_bodies' existence + policy shape; no body access.
      vault_seal_probe:   { Args: Record<never, never>; Returns: { body_table_exists: boolean; body_has_read_policy: boolean; body_has_insert_policy: boolean; meta_table_exists: boolean }[] };
    };
  };
};
