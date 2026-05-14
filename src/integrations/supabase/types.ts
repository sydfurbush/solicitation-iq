export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_description: string
          event_type: string
          id: string
          metadata: Json
          solicitation_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_description: string
          event_type: string
          id?: string
          metadata?: Json
          solicitation_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_description?: string
          event_type?: string
          id?: string
          metadata?: Json
          solicitation_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_settings: {
        Row: {
          function_name: string
          max_tokens: number | null
          model: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          function_name: string
          max_tokens?: number | null
          model: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          function_name?: string
          max_tokens?: number | null
          model?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      annotations: {
        Row: {
          annotation_type: Database["public"]["Enums"]["annotation_type"]
          content: string
          created_at: string | null
          document_id: string | null
          id: string
          is_resolved: boolean | null
          metadata: Json | null
          page_number: number | null
          position_data: Json | null
          resolved_at: string | null
          resolved_by: string | null
          section_id: string | null
          solicitation_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annotation_type: Database["public"]["Enums"]["annotation_type"]
          content: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          page_number?: number | null
          position_data?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: string | null
          solicitation_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annotation_type?: Database["public"]["Enums"]["annotation_type"]
          content?: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          page_number?: number | null
          position_data?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: string | null
          solicitation_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "document_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_gaps: {
        Row: {
          client_note: string | null
          created_at: string
          description: string | null
          gap_type: Database["public"]["Enums"]["gap_type"]
          id: string
          is_ai_generated: boolean
          is_resolved: boolean
          recommendation:
            | Database["public"]["Enums"]["gap_recommendation"]
            | null
          requirement_id: string | null
          severity: Database["public"]["Enums"]["gap_severity"]
          solicitation_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_note?: string | null
          created_at?: string
          description?: string | null
          gap_type?: Database["public"]["Enums"]["gap_type"]
          id?: string
          is_ai_generated?: boolean
          is_resolved?: boolean
          recommendation?:
            | Database["public"]["Enums"]["gap_recommendation"]
            | null
          requirement_id?: string | null
          severity?: Database["public"]["Enums"]["gap_severity"]
          solicitation_id: string
          title: string
          updated_at?: string
        }
        Update: {
          client_note?: string | null
          created_at?: string
          description?: string | null
          gap_type?: Database["public"]["Enums"]["gap_type"]
          id?: string
          is_ai_generated?: boolean
          is_resolved?: boolean
          recommendation?:
            | Database["public"]["Enums"]["gap_recommendation"]
            | null
          requirement_id?: string | null
          severity?: Database["public"]["Enums"]["gap_severity"]
          solicitation_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_knowledge_chunks: {
        Row: {
          chunk_index: number
          client_id: string
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          token_estimate: number | null
        }
        Insert: {
          chunk_index: number
          client_id: string
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          token_estimate?: number | null
        }
        Update: {
          chunk_index?: number
          client_id?: string
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          token_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_knowledge_documents: {
        Row: {
          byte_size: number | null
          chunk_count: number
          client_id: string
          created_at: string
          created_by: string | null
          error: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          raw_text: string | null
          source_type: string
          source_url: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          byte_size?: number | null
          chunk_count?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          raw_text?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          byte_size?: number | null
          chunk_count?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          raw_text?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_notifications: {
        Row: {
          client_user_id: string
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          message: string | null
          notification_type: string
          read_at: string | null
          solicitation_id: string | null
          title: string
        }
        Insert: {
          client_user_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string | null
          notification_type: string
          read_at?: string | null
          solicitation_id?: string | null
          title: string
        }
        Update: {
          client_user_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string | null
          notification_type?: string
          read_at?: string | null
          solicitation_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          acronym_glossary: Json
          agencies_focus: string[]
          always_flag: Json
          bonding: Json
          buyer_relationships: Json
          client_id: string
          compliance_frameworks: string[]
          contract_vehicles: string[]
          created_at: string
          delivery_models: string[]
          discriminators: Json
          diversity_tiers: Json
          extra_notes: string | null
          id: string
          iso_rto: string | null
          labor_posture: Json
          naics_codes: string[]
          preset_key: string | null
          psc_codes: string[]
          reading_level: number
          regulatory_bodies: string[]
          safety_metrics: Json
          service_categories: string[]
          service_territory: Json
          set_asides: string[]
          storm_response: Json
          tech_stack: Json
          tone_voice: string
          updated_at: string
          updated_by: string | null
          version: number
          workforce_capacity: Json
        }
        Insert: {
          acronym_glossary?: Json
          agencies_focus?: string[]
          always_flag?: Json
          bonding?: Json
          buyer_relationships?: Json
          client_id: string
          compliance_frameworks?: string[]
          contract_vehicles?: string[]
          created_at?: string
          delivery_models?: string[]
          discriminators?: Json
          diversity_tiers?: Json
          extra_notes?: string | null
          id?: string
          iso_rto?: string | null
          labor_posture?: Json
          naics_codes?: string[]
          preset_key?: string | null
          psc_codes?: string[]
          reading_level?: number
          regulatory_bodies?: string[]
          safety_metrics?: Json
          service_categories?: string[]
          service_territory?: Json
          set_asides?: string[]
          storm_response?: Json
          tech_stack?: Json
          tone_voice?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workforce_capacity?: Json
        }
        Update: {
          acronym_glossary?: Json
          agencies_focus?: string[]
          always_flag?: Json
          bonding?: Json
          buyer_relationships?: Json
          client_id?: string
          compliance_frameworks?: string[]
          contract_vehicles?: string[]
          created_at?: string
          delivery_models?: string[]
          discriminators?: Json
          diversity_tiers?: Json
          extra_notes?: string | null
          id?: string
          iso_rto?: string | null
          labor_posture?: Json
          naics_codes?: string[]
          preset_key?: string | null
          psc_codes?: string[]
          reading_level?: number
          regulatory_bodies?: string[]
          safety_metrics?: Json
          service_categories?: string[]
          service_territory?: Json
          set_asides?: string[]
          storm_response?: Json
          tech_stack?: Json
          tone_voice?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workforce_capacity?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_support_messages: {
        Row: {
          client_id: string
          client_user_id: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          solicitation_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_user_id: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          solicitation_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_user_id?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          solicitation_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_support_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_support_messages_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_support_messages_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_user_invitations: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_user_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          avatar_url: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          is_primary: boolean | null
          last_login_at: string | null
          notification_preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_primary?: boolean | null
          last_login_at?: string | null
          notification_preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_login_at?: string | null
          notification_preferences?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          access_level:
            | Database["public"]["Enums"]["client_access_level"]
            | null
          created_at: string | null
          deleted_at: string | null
          id: string
          industry: string | null
          logo_url: string | null
          metadata: Json | null
          name: string
          notes: string | null
          organization_id: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          access_level?:
            | Database["public"]["Enums"]["client_access_level"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          organization_id: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          access_level?:
            | Database["public"]["Enums"]["client_access_level"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          organization_id?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delta_actions: {
        Row: {
          assigned_to: string | null
          change_category: string | null
          change_ref: Json
          created_at: string
          delta_run_id: string | null
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          note: string | null
          prior_solicitation_id: string | null
          priority: string
          recommended_action: string
          solicitation_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          change_category?: string | null
          change_ref?: Json
          created_at?: string
          delta_run_id?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          note?: string | null
          prior_solicitation_id?: string | null
          priority?: string
          recommended_action?: string
          solicitation_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          change_category?: string | null
          change_ref?: Json
          created_at?: string
          delta_run_id?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          note?: string | null
          prior_solicitation_id?: string | null
          priority?: string
          recommended_action?: string
          solicitation_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delta_actions_delta_run_id_fkey"
            columns: ["delta_run_id"]
            isOneToOne: false
            referencedRelation: "delta_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delta_actions_prior_solicitation_id_fkey"
            columns: ["prior_solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delta_actions_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      delta_runs: {
        Row: {
          completed_at: string | null
          completed_batches: number
          current_step: string | null
          error_message: string | null
          failed_batches: number
          id: string
          prior_solicitation_id: string | null
          solicitation_id: string
          started_at: string
          status: string
          total_batches: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_batches?: number
          current_step?: string | null
          error_message?: string | null
          failed_batches?: number
          id?: string
          prior_solicitation_id?: string | null
          solicitation_id: string
          started_at?: string
          status?: string
          total_batches?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_batches?: number
          current_step?: string | null
          error_message?: string | null
          failed_batches?: number
          id?: string
          prior_solicitation_id?: string | null
          solicitation_id?: string
          started_at?: string
          status?: string
          total_batches?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delta_runs_prior_solicitation_id_fkey"
            columns: ["prior_solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delta_runs_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reviews: {
        Row: {
          document_id: string
          id: string
          reviewed_at: string
          reviewed_revision_id: string | null
          user_id: string
        }
        Insert: {
          document_id: string
          id?: string
          reviewed_at?: string
          reviewed_revision_id?: string | null
          user_id: string
        }
        Update: {
          document_id?: string
          id?: string
          reviewed_at?: string
          reviewed_revision_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_reviews_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_reviews_reviewed_revision_id_fkey"
            columns: ["reviewed_revision_id"]
            isOneToOne: false
            referencedRelation: "solicitation_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sections: {
        Row: {
          ai_importance_score: number | null
          ai_tags: string[] | null
          content: string
          content_type: string | null
          created_at: string | null
          depth: number | null
          document_id: string
          id: string
          page_end: number | null
          page_start: number | null
          parent_section_id: string | null
          section_number: string | null
          section_title: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          ai_importance_score?: number | null
          ai_tags?: string[] | null
          content: string
          content_type?: string | null
          created_at?: string | null
          depth?: number | null
          document_id: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          parent_section_id?: string | null
          section_number?: string | null
          section_title?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_importance_score?: number | null
          ai_tags?: string[] | null
          content?: string
          content_type?: string | null
          created_at?: string | null
          depth?: number | null
          document_id?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          parent_section_id?: string | null
          section_number?: string | null
          section_title?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_sections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sections_parent_section_id_fkey"
            columns: ["parent_section_id"]
            isOneToOne: false
            referencedRelation: "document_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_document_classification: Json | null
          ai_summary: string | null
          created_at: string | null
          deleted_at: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_current: boolean | null
          metadata: Json | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          replaces_document_id: string | null
          revision_id: string | null
          solicitation_id: string
          status: Database["public"]["Enums"]["document_status"] | null
          table_of_contents: Json | null
          total_pages: number | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          ai_document_classification?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          deleted_at?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean | null
          metadata?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          replaces_document_id?: string | null
          revision_id?: string | null
          solicitation_id: string
          status?: Database["public"]["Enums"]["document_status"] | null
          table_of_contents?: Json | null
          total_pages?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          ai_document_classification?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          deleted_at?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean | null
          metadata?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          replaces_document_id?: string | null
          revision_id?: string | null
          solicitation_id?: string
          status?: Database["public"]["Enums"]["document_status"] | null
          table_of_contents?: Json | null
          total_pages?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_replaces_document_id_fkey"
            columns: ["replaces_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "solicitation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_reports: {
        Row: {
          client_accessible: boolean | null
          content: Json
          created_at: string | null
          file_path: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          is_published: boolean | null
          metadata: Json | null
          published_at: string | null
          report_type: string | null
          solicitation_id: string
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          client_accessible?: boolean | null
          content: Json
          created_at?: string | null
          file_path?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_published?: boolean | null
          metadata?: Json | null
          published_at?: string | null
          report_type?: string | null
          solicitation_id: string
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          client_accessible?: boolean | null
          content?: Json
          created_at?: string | null
          file_path?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_published?: boolean | null
          metadata?: Json | null
          published_at?: string | null
          report_type?: string | null
          solicitation_id?: string
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_reports_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      export_history: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string
          file_size: number | null
          filename: string
          format: string
          id: string
          kind: string
          organization_id: string
          page_size: string | null
          sections: Json
          solicitation_id: string
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path: string
          file_size?: number | null
          filename: string
          format: string
          id?: string
          kind: string
          organization_id: string
          page_size?: string | null
          sections?: Json
          solicitation_id: string
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string
          file_size?: number | null
          filename?: string
          format?: string
          id?: string
          kind?: string
          organization_id?: string
          page_size?: string | null
          sections?: Json
          solicitation_id?: string
          version?: string | null
        }
        Relationships: []
      }
      extracted_entities: {
        Row: {
          confidence_score: number | null
          context_snippet: string | null
          created_at: string | null
          document_id: string
          entity_type: string
          entity_value: string
          id: string
          metadata: Json | null
          normalized_value: string | null
          page_number: number | null
          section_id: string | null
          section_reference: string | null
        }
        Insert: {
          confidence_score?: number | null
          context_snippet?: string | null
          created_at?: string | null
          document_id: string
          entity_type: string
          entity_value: string
          id?: string
          metadata?: Json | null
          normalized_value?: string | null
          page_number?: number | null
          section_id?: string | null
          section_reference?: string | null
        }
        Update: {
          confidence_score?: number | null
          context_snippet?: string | null
          created_at?: string | null
          document_id?: string
          entity_type?: string
          entity_value?: string
          id?: string
          metadata?: Json | null
          normalized_value?: string | null
          page_number?: number | null
          section_id?: string | null
          section_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_entities_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "document_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          client_capability_match: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          impact_score: number | null
          is_ai_generated: boolean | null
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          recommended_approach: string | null
          solicitation_id: string
          source_citation: string | null
          source_document_id: string | null
          source_quote: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_capability_match?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          impact_score?: number | null
          is_ai_generated?: boolean | null
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          recommended_approach?: string | null
          solicitation_id: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_capability_match?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          impact_score?: number | null
          is_ai_generated?: boolean | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          recommended_approach?: string | null
          solicitation_id?: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      outline_nodes: {
        Row: {
          assigned_to: string | null
          created_at: string
          due_date: string | null
          id: string
          linked_requirement_ids: string[]
          notes: string | null
          outline_id: string
          page_allocation: number | null
          parent_id: string | null
          section_number: string | null
          sort_order: number
          source_l_reference: string | null
          title: string
          updated_at: string
          volume: string | null
          writing_status: Database["public"]["Enums"]["writing_status"]
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          linked_requirement_ids?: string[]
          notes?: string | null
          outline_id: string
          page_allocation?: number | null
          parent_id?: string | null
          section_number?: string | null
          sort_order?: number
          source_l_reference?: string | null
          title: string
          updated_at?: string
          volume?: string | null
          writing_status?: Database["public"]["Enums"]["writing_status"]
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          linked_requirement_ids?: string[]
          notes?: string | null
          outline_id?: string
          page_allocation?: number | null
          parent_id?: string | null
          section_number?: string | null
          sort_order?: number
          source_l_reference?: string | null
          title?: string
          updated_at?: string
          volume?: string | null
          writing_status?: Database["public"]["Enums"]["writing_status"]
        }
        Relationships: [
          {
            foreignKeyName: "outline_nodes_outline_id_fkey"
            columns: ["outline_id"]
            isOneToOne: false
            referencedRelation: "proposal_outlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outline_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "outline_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          decision_note: string | null
          id: string
          phase: Database["public"]["Enums"]["phase_type"]
          requested_at: string | null
          requested_by: string | null
          solicitation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          id?: string
          phase: Database["public"]["Enums"]["phase_type"]
          requested_at?: string | null
          requested_by?: string | null
          solicitation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["phase_type"]
          requested_at?: string | null
          requested_by?: string | null
          solicitation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      prior_import_history: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          error_response: Json | null
          failed_attachments: Json
          failed_count: number
          found_count: number
          id: string
          imported_count: number
          lookup_params: Json
          performed_by: string | null
          prior_link_id: string
          prior_solicitation_id: string | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          action?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          error_response?: Json | null
          failed_attachments?: Json
          failed_count?: number
          found_count?: number
          id?: string
          imported_count?: number
          lookup_params?: Json
          performed_by?: string | null
          prior_link_id: string
          prior_solicitation_id?: string | null
          source?: string
          started_at?: string
          status?: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          error_response?: Json | null
          failed_attachments?: Json
          failed_count?: number
          found_count?: number
          id?: string
          imported_count?: number
          lookup_params?: Json
          performed_by?: string | null
          prior_link_id?: string
          prior_solicitation_id?: string | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      prior_solicitations: {
        Row: {
          changes_identified: Json | null
          comparison_completed_at: string | null
          comparison_summary: string | null
          created_at: string | null
          external_reference: string | null
          external_url: string | null
          id: string
          prior_solicitation_id: string | null
          revision_a_id: string | null
          revision_b_id: string | null
          solicitation_id: string
          updated_at: string | null
        }
        Insert: {
          changes_identified?: Json | null
          comparison_completed_at?: string | null
          comparison_summary?: string | null
          created_at?: string | null
          external_reference?: string | null
          external_url?: string | null
          id?: string
          prior_solicitation_id?: string | null
          revision_a_id?: string | null
          revision_b_id?: string | null
          solicitation_id: string
          updated_at?: string | null
        }
        Update: {
          changes_identified?: Json | null
          comparison_completed_at?: string | null
          comparison_summary?: string | null
          created_at?: string | null
          external_reference?: string | null
          external_url?: string | null
          id?: string
          prior_solicitation_id?: string | null
          revision_a_id?: string | null
          revision_b_id?: string | null
          solicitation_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prior_solicitations_prior_solicitation_id_fkey"
            columns: ["prior_solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prior_solicitations_revision_a_id_fkey"
            columns: ["revision_a_id"]
            isOneToOne: false
            referencedRelation: "solicitation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prior_solicitations_revision_b_id_fkey"
            columns: ["revision_b_id"]
            isOneToOne: false
            referencedRelation: "solicitation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prior_solicitations_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_outlines: {
        Row: {
          created_at: string
          generated_at: string | null
          generated_by: string | null
          id: string
          is_active: boolean
          metadata: Json
          solicitation_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          solicitation_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          solicitation_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      question_generation_runs: {
        Row: {
          completed_at: string | null
          completed_batches: number
          cross_doc_failed: boolean
          current_step: string | null
          error_message: string | null
          failed_batches: number
          failed_doc_ids: string[]
          id: string
          inserted_count: number
          parent_run_id: string | null
          solicitation_id: string
          started_at: string
          status: string
          total_batches: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_batches?: number
          cross_doc_failed?: boolean
          current_step?: string | null
          error_message?: string | null
          failed_batches?: number
          failed_doc_ids?: string[]
          id?: string
          inserted_count?: number
          parent_run_id?: string | null
          solicitation_id: string
          started_at?: string
          status?: string
          total_batches?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_batches?: number
          cross_doc_failed?: boolean
          current_step?: string | null
          error_message?: string | null
          failed_batches?: number
          failed_doc_ids?: string[]
          id?: string
          inserted_count?: number
          parent_run_id?: string | null
          solicitation_id?: string
          started_at?: string
          status?: string
          total_batches?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_generation_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "question_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_item_versions: {
        Row: {
          change_summary: string | null
          changed_at: string
          changed_by: string | null
          id: string
          requirement_id: string
          snapshot: Json
          solicitation_id: string
        }
        Insert: {
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          requirement_id: string
          snapshot: Json
          solicitation_id: string
        }
        Update: {
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          requirement_id?: string
          snapshot?: Json
          solicitation_id?: string
        }
        Relationships: []
      }
      requirement_items: {
        Row: {
          compliance_owner: string | null
          created_at: string
          created_by: string | null
          id: string
          is_ai_generated: boolean
          notes: string | null
          page_number: number | null
          proposal_section: string | null
          proposal_volume: string | null
          req_number: string
          shall_text: string
          solicitation_id: string
          source_citation: string | null
          source_document_id: string | null
          source_quote: string | null
          source_section: string | null
          status: Database["public"]["Enums"]["requirement_status"]
          updated_at: string
        }
        Insert: {
          compliance_owner?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_ai_generated?: boolean
          notes?: string | null
          page_number?: number | null
          proposal_section?: string | null
          proposal_volume?: string | null
          req_number: string
          shall_text: string
          solicitation_id: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          source_section?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          updated_at?: string
        }
        Update: {
          compliance_owner?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_ai_generated?: boolean
          notes?: string | null
          page_number?: number | null
          proposal_section?: string | null
          proposal_volume?: string | null
          req_number?: string
          shall_text?: string
          solicitation_id?: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          source_section?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          updated_at?: string
        }
        Relationships: []
      }
      revision_reviews: {
        Row: {
          id: string
          reviewed_at: string
          revision_id: string
          user_id: string
        }
        Insert: {
          id?: string
          reviewed_at?: string
          revision_id: string
          user_id: string
        }
        Update: {
          id?: string
          reviewed_at?: string
          revision_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_reviews_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "solicitation_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          is_ai_generated: boolean | null
          is_mitigated: boolean | null
          mitigation_strategy: string | null
          severity: Database["public"]["Enums"]["risk_severity"] | null
          solicitation_id: string
          source_citation: string | null
          source_document_id: string | null
          source_quote: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          is_ai_generated?: boolean | null
          is_mitigated?: boolean | null
          mitigation_strategy?: string | null
          severity?: Database["public"]["Enums"]["risk_severity"] | null
          solicitation_id: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          is_ai_generated?: boolean | null
          is_mitigated?: boolean | null
          mitigation_strategy?: string | null
          severity?: Database["public"]["Enums"]["risk_severity"] | null
          solicitation_id?: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      section_analyses: {
        Row: {
          created_at: string
          id: string
          importance_rationale: string | null
          importance_score: number | null
          is_ai_generated: boolean
          requirements_count: number | null
          risk_flags: Json
          scoring_weight: number | null
          section_code: string
          section_title: string | null
          solicitation_id: string
          source_citations: Json
          summary: string | null
          updated_at: string
          weight_source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          importance_rationale?: string | null
          importance_score?: number | null
          is_ai_generated?: boolean
          requirements_count?: number | null
          risk_flags?: Json
          scoring_weight?: number | null
          section_code: string
          section_title?: string | null
          solicitation_id: string
          source_citations?: Json
          summary?: string | null
          updated_at?: string
          weight_source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          importance_rationale?: string | null
          importance_score?: number | null
          is_ai_generated?: boolean
          requirements_count?: number | null
          risk_flags?: Json
          scoring_weight?: number | null
          section_code?: string
          section_title?: string | null
          solicitation_id?: string
          source_citations?: Json
          summary?: string | null
          updated_at?: string
          weight_source?: string | null
        }
        Relationships: []
      }
      solicitation_access: {
        Row: {
          access_level: string | null
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          solicitation_id: string
          user_id: string
        }
        Insert: {
          access_level?: string | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          solicitation_id: string
          user_id: string
        }
        Update: {
          access_level?: string | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          solicitation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitation_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitation_access_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitation_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitation_phases: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          deliverables: Json | null
          id: string
          notes: string | null
          phase: Database["public"]["Enums"]["phase_type"]
          solicitation_id: string
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deliverables?: Json | null
          id?: string
          notes?: string | null
          phase: Database["public"]["Enums"]["phase_type"]
          solicitation_id: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deliverables?: Json | null
          id?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["phase_type"]
          solicitation_id?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitation_phases_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitation_phases_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitation_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["revision_kind"]
          label: string
          notes: string | null
          received_at: string
          sam_notice_id: string | null
          sequence: number
          solicitation_id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["revision_kind"]
          label: string
          notes?: string | null
          received_at?: string
          sam_notice_id?: string | null
          sequence?: number
          solicitation_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["revision_kind"]
          label?: string
          notes?: string | null
          received_at?: string
          sam_notice_id?: string | null
          sequence?: number
          solicitation_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitation_revisions_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitation_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          snapshot_label: string
          solicitation_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          snapshot_label: string
          solicitation_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          snapshot_label?: string
          solicitation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitation_snapshots_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitations: {
        Row: {
          agency_type: string | null
          ai_confidence_score: number | null
          ai_summary: string | null
          client_id: string
          contract_type: string | null
          created_at: string | null
          current_phase: Database["public"]["Enums"]["phase_type"] | null
          deleted_at: string | null
          estimated_value_high: number | null
          estimated_value_low: number | null
          evaluation_factors: Json | null
          expected_award_date: string | null
          has_incumbent: boolean | null
          id: string
          incumbent_contract_number: string | null
          incumbent_contract_value: number | null
          incumbent_name: string | null
          incumbent_performance_notes: string | null
          issuing_agency: string | null
          key_requirements: Json | null
          lens_overrides: Json
          metadata: Json | null
          parent_solicitation_id: string | null
          period_of_performance_end: string | null
          period_of_performance_start: string | null
          proposal_due_date: string | null
          questions_due_date: string | null
          release_date: string | null
          sam_url: string | null
          set_aside: string | null
          solicitation_number: string | null
          stage: Database["public"]["Enums"]["solicitation_stage"]
          stage_label: string | null
          status: Database["public"]["Enums"]["solicitation_status"] | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agency_type?: string | null
          ai_confidence_score?: number | null
          ai_summary?: string | null
          client_id: string
          contract_type?: string | null
          created_at?: string | null
          current_phase?: Database["public"]["Enums"]["phase_type"] | null
          deleted_at?: string | null
          estimated_value_high?: number | null
          estimated_value_low?: number | null
          evaluation_factors?: Json | null
          expected_award_date?: string | null
          has_incumbent?: boolean | null
          id?: string
          incumbent_contract_number?: string | null
          incumbent_contract_value?: number | null
          incumbent_name?: string | null
          incumbent_performance_notes?: string | null
          issuing_agency?: string | null
          key_requirements?: Json | null
          lens_overrides?: Json
          metadata?: Json | null
          parent_solicitation_id?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          proposal_due_date?: string | null
          questions_due_date?: string | null
          release_date?: string | null
          sam_url?: string | null
          set_aside?: string | null
          solicitation_number?: string | null
          stage?: Database["public"]["Enums"]["solicitation_stage"]
          stage_label?: string | null
          status?: Database["public"]["Enums"]["solicitation_status"] | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agency_type?: string | null
          ai_confidence_score?: number | null
          ai_summary?: string | null
          client_id?: string
          contract_type?: string | null
          created_at?: string | null
          current_phase?: Database["public"]["Enums"]["phase_type"] | null
          deleted_at?: string | null
          estimated_value_high?: number | null
          estimated_value_low?: number | null
          evaluation_factors?: Json | null
          expected_award_date?: string | null
          has_incumbent?: boolean | null
          id?: string
          incumbent_contract_number?: string | null
          incumbent_contract_value?: number | null
          incumbent_name?: string | null
          incumbent_performance_notes?: string | null
          issuing_agency?: string | null
          key_requirements?: Json | null
          lens_overrides?: Json
          metadata?: Json | null
          parent_solicitation_id?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          proposal_due_date?: string | null
          questions_due_date?: string | null
          release_date?: string | null
          sam_url?: string | null
          set_aside?: string | null
          solicitation_number?: string | null
          stage?: Database["public"]["Enums"]["solicitation_stage"]
          stage_label?: string | null
          status?: Database["public"]["Enums"]["solicitation_status"] | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitations_parent_solicitation_id_fkey"
            columns: ["parent_solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_questions: {
        Row: {
          agency_response: string | null
          category: Database["public"]["Enums"]["question_category"]
          created_at: string | null
          created_by: string | null
          id: string
          is_ai_generated: boolean | null
          is_submitted: boolean | null
          potential_answer_insight: string | null
          priority: number | null
          question_rationale: string | null
          question_text: string
          recommendation:
            | Database["public"]["Enums"]["question_recommendation"]
            | null
          solicitation_id: string
          source_citation: string | null
          source_document_id: string | null
          source_quote: string | null
          source_section_id: string | null
          strategic_advantage_notes: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          agency_response?: string | null
          category: Database["public"]["Enums"]["question_category"]
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_submitted?: boolean | null
          potential_answer_insight?: string | null
          priority?: number | null
          question_rationale?: string | null
          question_text: string
          recommendation?:
            | Database["public"]["Enums"]["question_recommendation"]
            | null
          solicitation_id: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          source_section_id?: string | null
          strategic_advantage_notes?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_response?: string | null
          category?: Database["public"]["Enums"]["question_category"]
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_submitted?: boolean | null
          potential_answer_insight?: string | null
          priority?: number | null
          question_rationale?: string | null
          question_text?: string
          recommendation?:
            | Database["public"]["Enums"]["question_recommendation"]
            | null
          solicitation_id?: string
          source_citation?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          source_section_id?: string | null
          strategic_advantage_notes?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_questions_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_questions_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_questions_source_section_id_fkey"
            columns: ["source_section_id"]
            isOneToOne: false
            referencedRelation: "document_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          api_key: string
          created_at: string
          id: string
          last_four: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          last_four?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          last_four?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      win_themes: {
        Row: {
          created_at: string
          created_by: string | null
          discriminators: string[]
          ghosting_points: string[]
          id: string
          is_ai_generated: boolean
          linked_outline_node_ids: string[]
          linked_requirement_ids: string[]
          proof_points: string[]
          solicitation_id: string
          source_citations: Json
          status: Database["public"]["Enums"]["win_theme_status"]
          theme_statement: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discriminators?: string[]
          ghosting_points?: string[]
          id?: string
          is_ai_generated?: boolean
          linked_outline_node_ids?: string[]
          linked_requirement_ids?: string[]
          proof_points?: string[]
          solicitation_id: string
          source_citations?: Json
          status?: Database["public"]["Enums"]["win_theme_status"]
          theme_statement?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discriminators?: string[]
          ghosting_points?: string[]
          id?: string
          is_ai_generated?: boolean
          linked_outline_node_ids?: string[]
          linked_requirement_ids?: string[]
          proof_points?: string[]
          solicitation_id?: string
          source_citations?: Json
          status?: Database["public"]["Enums"]["win_theme_status"]
          theme_statement?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clone_solicitation_for_stage: {
        Args: {
          p_new_stage: Database["public"]["Enums"]["solicitation_stage"]
          p_new_title?: string
          p_source_id: string
          p_stage_label?: string
        }
        Returns: string
      }
      current_client_id: { Args: never; Returns: string }
      current_user_org: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_user: { Args: { _user_id: string }; Returns: boolean }
      is_org_staff: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_event_description: string
          p_event_type: string
          p_metadata?: Json
          p_solicitation_id: string
          p_user_id: string
        }
        Returns: string
      }
      match_client_knowledge: {
        Args: {
          p_client_id: string
          p_match_count?: number
          p_min_similarity?: number
          p_query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          document_id: string
          document_title: string
          similarity: number
          source_type: string
          source_url: string
          tags: string[]
        }[]
      }
      search_document_content: {
        Args: { p_search_term: string; p_solicitation_id: string }
        Returns: {
          document_id: string
          document_name: string
          page_number: number
          rank: number
          section_id: string
          section_title: string
          snippet: string
        }[]
      }
    }
    Enums: {
      annotation_type:
        | "note"
        | "flag"
        | "question"
        | "highlight"
        | "action_item"
        | "win_theme"
        | "discriminator"
      app_role: "owner" | "admin" | "analyst" | "viewer"
      client_access_level: "full" | "summary" | "restricted"
      document_status:
        | "uploading"
        | "processing"
        | "parsed"
        | "analyzed"
        | "failed"
      document_type:
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
        | "other"
      gap_recommendation: "build" | "buy" | "team" | "no_bid" | "accept"
      gap_severity: "low" | "medium" | "high" | "critical"
      gap_type:
        | "capability"
        | "past_performance"
        | "certification"
        | "teaming"
        | "other"
      opportunity_type:
        | "innovation"
        | "cost_reduction"
        | "scope_expansion"
        | "efficiency"
        | "differentiation"
        | "incumbent_weakness"
        | "evaluation_advantage"
      phase_type:
        | "phase_1_initial"
        | "phase_2_deep_dive"
        | "phase_3_outline"
        | "phase_4_win_themes"
      question_category:
        | "clarification"
        | "strategic"
        | "scope_expansion"
        | "risk_concern"
        | "compliance"
        | "other"
        | "drafting_error"
        | "contradiction"
        | "quantitative_gap"
      question_recommendation: "ask" | "hold" | "monitor" | "internal_only"
      requirement_status: "open" | "in_review" | "covered" | "waived"
      revision_kind: "pre_sol" | "amendment" | "final" | "draft" | "other"
      risk_severity: "critical" | "high" | "medium" | "low" | "informational"
      solicitation_stage:
        | "pre_solicitation"
        | "draft_rfp"
        | "final"
        | "amendment"
      solicitation_status:
        | "intake"
        | "processing"
        | "phase_1_complete"
        | "phase_2_active"
        | "phase_3_active"
        | "phase_4_active"
        | "complete"
        | "archived"
      win_theme_status: "draft" | "approved" | "rejected"
      writing_status:
        | "not_started"
        | "drafting"
        | "pink_ready"
        | "red_ready"
        | "final"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      annotation_type: [
        "note",
        "flag",
        "question",
        "highlight",
        "action_item",
        "win_theme",
        "discriminator",
      ],
      app_role: ["owner", "admin", "analyst", "viewer"],
      client_access_level: ["full", "summary", "restricted"],
      document_status: [
        "uploading",
        "processing",
        "parsed",
        "analyzed",
        "failed",
      ],
      document_type: [
        "rfp",
        "rfq",
        "rfi",
        "pre_solicitation",
        "sow",
        "terms_conditions",
        "amendment",
        "qa_log",
        "evaluation_criteria",
        "pricing_sheet",
        "incumbent_contract",
        "prior_solicitation",
        "attachment",
        "other",
      ],
      gap_recommendation: ["build", "buy", "team", "no_bid", "accept"],
      gap_severity: ["low", "medium", "high", "critical"],
      gap_type: [
        "capability",
        "past_performance",
        "certification",
        "teaming",
        "other",
      ],
      opportunity_type: [
        "innovation",
        "cost_reduction",
        "scope_expansion",
        "efficiency",
        "differentiation",
        "incumbent_weakness",
        "evaluation_advantage",
      ],
      phase_type: [
        "phase_1_initial",
        "phase_2_deep_dive",
        "phase_3_outline",
        "phase_4_win_themes",
      ],
      question_category: [
        "clarification",
        "strategic",
        "scope_expansion",
        "risk_concern",
        "compliance",
        "other",
        "drafting_error",
        "contradiction",
        "quantitative_gap",
      ],
      question_recommendation: ["ask", "hold", "monitor", "internal_only"],
      requirement_status: ["open", "in_review", "covered", "waived"],
      revision_kind: ["pre_sol", "amendment", "final", "draft", "other"],
      risk_severity: ["critical", "high", "medium", "low", "informational"],
      solicitation_stage: [
        "pre_solicitation",
        "draft_rfp",
        "final",
        "amendment",
      ],
      solicitation_status: [
        "intake",
        "processing",
        "phase_1_complete",
        "phase_2_active",
        "phase_3_active",
        "phase_4_active",
        "complete",
        "archived",
      ],
      win_theme_status: ["draft", "approved", "rejected"],
      writing_status: [
        "not_started",
        "drafting",
        "pink_ready",
        "red_ready",
        "final",
      ],
    },
  },
} as const
