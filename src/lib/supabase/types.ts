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
      artifacts:         { Row: Artifact;        Insert: Omit<Artifact, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Artifact> };
      artifact_versions: { Row: ArtifactVersion; Insert: Omit<ArtifactVersion, 'id' | 'created_at'>; Update: Partial<ArtifactVersion> };
      approval_events:   { Row: ApprovalEvent;   Insert: Omit<ApprovalEvent, 'id' | 'created_at'>; Update: never };
      docket_ids:        { Row: DocketId;        Insert: Omit<DocketId, 'id' | 'created_at'>; Update: never };
      trophy_room_entries: { Row: TrophyRoomEntry; Insert: Omit<TrophyRoomEntry, 'id' | 'created_at'>; Update: Partial<TrophyRoomEntry> };
      founding_sessions: { Row: FoundingSession; Insert: Omit<FoundingSession, 'id' | 'created_at' | 'updated_at'>; Update: Partial<FoundingSession> };
      commissioner_notes: { Row: CommissionerNote; Insert: Omit<CommissionerNote, 'id' | 'created_at'>; Update: never };
      sync_log:          { Row: SyncLog;         Insert: Omit<SyncLog, 'id' | 'created_at'>; Update: never };
      audit_log:         { Row: AuditLog;        Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: never };
    };
    Functions: {
      get_user_league_id: { Args: Record<never, never>; Returns: string };
      is_commissioner:    { Args: { p_league_id: string }; Returns: boolean };
      is_admin:           { Args: Record<never, never>; Returns: boolean };
    };
  };
};
