// Domain types for the Solicitation Intelligence Analyzer database.
// Mirrors the SQL schema; enums are expressed as union string literals.

// =====================================================
// ENUMS
// =====================================================
export type AppRole = "owner" | "admin" | "analyst" | "viewer";
export type ClientAccessLevel = "full" | "summary" | "restricted";
export type DocumentType =
  | "rfp"
  | "rfq"
  | "rfi"
  | "pre_solicitation"
  | "sow"
  | "terms_conditions"
  | "amendment"
  | "qa_log"
  | "evaluation_criteria"
  | "pricing_sheet"
  | "incumbent_contract"
  | "prior_solicitation"
  | "attachment"
  | "other";
export type DocumentStatus =
  | "uploading"
  | "processing"
  | "parsed"
  | "analyzed"
  | "failed";
export type SolicitationStatus =
  | "intake"
  | "processing"
  | "phase_1_complete"
  | "phase_2_active"
  | "phase_3_active"
  | "phase_4_active"
  | "complete"
  | "archived";
export type QuestionCategory =
  | "clarification"
  | "strategic"
  | "scope_expansion"
  | "risk_concern"
  | "compliance";
export type QuestionRecommendation =
  | "ask"
  | "hold"
  | "monitor"
  | "internal_only";
export type RiskSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";
export type OpportunityType =
  | "innovation"
  | "cost_reduction"
  | "scope_expansion"
  | "efficiency"
  | "differentiation"
  | "incumbent_weakness"
  | "evaluation_advantage";
export type PhaseType =
  | "phase_1_initial"
  | "phase_2_deep_dive"
  | "phase_3_outline"
  | "phase_4_win_themes";
export type AnnotationType =
  | "note"
  | "flag"
  | "question"
  | "highlight"
  | "action_item"
  | "win_theme"
  | "discriminator";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =====================================================
// TABLES
// =====================================================
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserProfile {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  settings: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  access_level: ClientAccessLevel;
  notes: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Solicitation {
  id: string;
  client_id: string;
  title: string;
  solicitation_number: string | null;
  issuing_agency: string | null;
  agency_type: string | null;
  release_date: string | null;
  questions_due_date: string | null;
  proposal_due_date: string | null;
  expected_award_date: string | null;
  period_of_performance_start: string | null;
  period_of_performance_end: string | null;
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  contract_type: string | null;
  has_incumbent: boolean;
  incumbent_name: string | null;
  incumbent_contract_number: string | null;
  incumbent_contract_value: number | null;
  incumbent_performance_notes: string | null;
  status: SolicitationStatus;
  current_phase: PhaseType;
  ai_summary: string | null;
  ai_confidence_score: number | null;
  key_requirements: Json;
  evaluation_factors: Json;
  tags: string[];
  metadata: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentRecord {
  id: string;
  solicitation_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  document_type: DocumentType;
  version: number;
  replaces_document_id: string | null;
  is_current: boolean;
  status: DocumentStatus;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_error: string | null;
  total_pages: number | null;
  extracted_text: string | null;
  table_of_contents: Json | null;
  ai_summary: string | null;
  ai_document_classification: Json | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentSection {
  id: string;
  document_id: string;
  section_number: string | null;
  section_title: string | null;
  page_start: number | null;
  page_end: number | null;
  content: string;
  content_type: string | null;
  parent_section_id: string | null;
  depth: number;
  sort_order: number;
  ai_importance_score: number | null;
  ai_tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ExtractedEntity {
  id: string;
  document_id: string;
  section_id: string | null;
  entity_type: string;
  entity_value: string;
  normalized_value: string | null;
  page_number: number | null;
  section_reference: string | null;
  context_snippet: string | null;
  confidence_score: number | null;
  metadata: Json;
  created_at: string;
}

export interface StrategicQuestion {
  id: string;
  solicitation_id: string;
  question_text: string;
  question_rationale: string | null;
  category: QuestionCategory;
  recommendation: QuestionRecommendation;
  priority: number;
  source_document_id: string | null;
  source_section_id: string | null;
  source_citation: string | null;
  source_quote: string | null;
  strategic_advantage_notes: string | null;
  potential_answer_insight: string | null;
  is_submitted: boolean;
  submitted_at: string | null;
  agency_response: string | null;
  is_ai_generated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Risk {
  id: string;
  solicitation_id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  source_document_id: string | null;
  source_citation: string | null;
  source_quote: string | null;
  mitigation_strategy: string | null;
  is_mitigated: boolean;
  is_ai_generated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  solicitation_id: string;
  title: string;
  description: string;
  opportunity_type: OpportunityType;
  impact_score: number;
  source_document_id: string | null;
  source_citation: string | null;
  source_quote: string | null;
  recommended_approach: string | null;
  client_capability_match: string | null;
  is_ai_generated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitationPhase {
  id: string;
  solicitation_id: string;
  phase: PhaseType;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  deliverables: Json;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  id: string;
  solicitation_id: string;
  document_id: string | null;
  section_id: string | null;
  user_id: string;
  annotation_type: AnnotationType;
  content: string;
  page_number: number | null;
  position_data: Json | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ExecutiveReport {
  id: string;
  solicitation_id: string;
  title: string;
  report_type: string;
  version: number;
  content: Json;
  generated_at: string;
  generated_by: string | null;
  is_published: boolean;
  published_at: string | null;
  client_accessible: boolean;
  file_path: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface SolicitationAccess {
  id: string;
  solicitation_id: string;
  user_id: string;
  access_level: string;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
}

export interface PriorSolicitation {
  id: string;
  solicitation_id: string;
  prior_solicitation_id: string | null;
  external_reference: string | null;
  external_url: string | null;
  comparison_summary: string | null;
  changes_identified: Json;
  comparison_completed_at: string | null;
  created_at: string;
  updated_at: string;
}
