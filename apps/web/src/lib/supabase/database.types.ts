export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          cost_cents: number;
          created_at: string;
          document_id: string | null;
          error_message: string | null;
          id: string;
          input_tokens: number;
          latency_ms: number;
          model: string;
          operation: string;
          opportunity_id: string | null;
          output_tokens: number;
          provider: string;
          success: boolean;
          user_id: string | null;
        };
        Insert: {
          cost_cents?: number;
          created_at?: string;
          document_id?: string | null;
          error_message?: string | null;
          id?: string;
          input_tokens?: number;
          latency_ms?: number;
          model: string;
          operation: string;
          opportunity_id?: string | null;
          output_tokens?: number;
          provider: string;
          success?: boolean;
          user_id?: string | null;
        };
        Update: {
          cost_cents?: number;
          created_at?: string;
          document_id?: string | null;
          error_message?: string | null;
          id?: string;
          input_tokens?: number;
          latency_ms?: number;
          model?: string;
          operation?: string;
          opportunity_id?: string | null;
          output_tokens?: number;
          provider?: string;
          success?: boolean;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          created_at: string | null;
          expires_at: string | null;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          scopes: string[] | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
          scopes?: string[] | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          scopes?: string[] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      beta_codes: {
        Row: {
          code: string;
          created_at: string | null;
          created_by: string | null;
          current_uses: number;
          expires_at: string | null;
          id: string;
          max_uses: number;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          created_by?: string | null;
          current_uses?: number;
          expires_at?: string | null;
          id?: string;
          max_uses?: number;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          created_by?: string | null;
          current_uses?: number;
          expires_at?: string | null;
          id?: string;
          max_uses?: number;
        };
        Relationships: [];
      };
      beta_waitlist: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      claim_evidence: {
        Row: {
          claim_id: string;
          created_at: string | null;
          evidence_id: string;
          id: string;
          strength: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string | null;
          evidence_id: string;
          id?: string;
          strength: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string | null;
          evidence_id?: string;
          id?: string;
          strength?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_evidence_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "identity_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_evidence_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_issues: {
        Row: {
          claim_id: string;
          created_at: string;
          dismissed_at: string | null;
          document_id: string | null;
          id: string;
          issue_type: string;
          message: string;
          related_claim_id: string | null;
          severity: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string;
          dismissed_at?: string | null;
          document_id?: string | null;
          id?: string;
          issue_type: string;
          message: string;
          related_claim_id?: string | null;
          severity?: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string;
          dismissed_at?: string | null;
          document_id?: string | null;
          id?: string;
          issue_type?: string;
          message?: string;
          related_claim_id?: string | null;
          severity?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_issues_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "identity_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_issues_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_issues_related_claim_id_fkey";
            columns: ["related_claim_id"];
            isOneToOne: false;
            referencedRelation: "identity_claims";
            referencedColumns: ["id"];
          },
        ];
      };
      claims: {
        Row: {
          claim_type: string;
          confidence: number | null;
          created_at: string | null;
          document_id: string | null;
          embedding: string | null;
          evidence_text: string | null;
          id: string;
          user_id: string;
          value: Json;
        };
        Insert: {
          claim_type: string;
          confidence?: number | null;
          created_at?: string | null;
          document_id?: string | null;
          embedding?: string | null;
          evidence_text?: string | null;
          id?: string;
          user_id: string;
          value: Json;
        };
        Update: {
          claim_type?: string;
          confidence?: number | null;
          created_at?: string | null;
          document_id?: string | null;
          embedding?: string | null;
          evidence_text?: string | null;
          id?: string;
          user_id?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "claims_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_jobs: {
        Row: {
          completed_at: string | null;
          content_hash: string | null;
          created_at: string | null;
          document_id: string | null;
          error: string | null;
          filename: string | null;
          highlights: Json | null;
          id: string;
          job_type: string;
          opportunity_id: string | null;
          phase: string | null;
          progress: string | null;
          started_at: string | null;
          status: string;
          summary: Json | null;
          updated_at: string | null;
          user_id: string;
          warning: string | null;
        };
        Insert: {
          completed_at?: string | null;
          content_hash?: string | null;
          created_at?: string | null;
          document_id?: string | null;
          error?: string | null;
          filename?: string | null;
          highlights?: Json | null;
          id?: string;
          job_type: string;
          opportunity_id?: string | null;
          phase?: string | null;
          progress?: string | null;
          started_at?: string | null;
          status?: string;
          summary?: Json | null;
          updated_at?: string | null;
          user_id: string;
          warning?: string | null;
        };
        Update: {
          completed_at?: string | null;
          content_hash?: string | null;
          created_at?: string | null;
          document_id?: string | null;
          error?: string | null;
          filename?: string | null;
          highlights?: Json | null;
          id?: string;
          job_type?: string;
          opportunity_id?: string | null;
          phase?: string | null;
          progress?: string | null;
          started_at?: string | null;
          status?: string;
          summary?: Json | null;
          updated_at?: string | null;
          user_id?: string;
          warning?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_jobs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_jobs_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          content_hash: string | null;
          created_at: string | null;
          filename: string | null;
          id: string;
          raw_text: string | null;
          status: string | null;
          storage_path: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          content_hash?: string | null;
          created_at?: string | null;
          filename?: string | null;
          id?: string;
          raw_text?: string | null;
          status?: string | null;
          storage_path?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          content_hash?: string | null;
          created_at?: string | null;
          filename?: string | null;
          id?: string;
          raw_text?: string | null;
          status?: string | null;
          storage_path?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence: {
        Row: {
          context: Json | null;
          created_at: string | null;
          document_id: string | null;
          embedding: string | null;
          evidence_date: string | null;
          evidence_type: string;
          id: string;
          source_type: string;
          text: string;
          user_id: string;
          work_history_id: string | null;
        };
        Insert: {
          context?: Json | null;
          created_at?: string | null;
          document_id?: string | null;
          embedding?: string | null;
          evidence_date?: string | null;
          evidence_type: string;
          id?: string;
          source_type?: string;
          text: string;
          user_id: string;
          work_history_id?: string | null;
        };
        Update: {
          context?: Json | null;
          created_at?: string | null;
          document_id?: string | null;
          embedding?: string | null;
          evidence_date?: string | null;
          evidence_type?: string;
          id?: string;
          source_type?: string;
          text?: string;
          user_id?: string;
          work_history_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_work_history_id_fkey";
            columns: ["work_history_id"];
            isOneToOne: false;
            referencedRelation: "work_history";
            referencedColumns: ["id"];
          },
        ];
      };
      identity_claims: {
        Row: {
          confidence: number | null;
          created_at: string | null;
          description: string | null;
          embedding: string | null;
          id: string;
          label: string;
          source: string | null;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          id?: string;
          label: string;
          source?: string | null;
          type: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          confidence?: number | null;
          created_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          id?: string;
          label?: string;
          source?: string | null;
          type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "identity_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          claim_id: string;
          created_at: string | null;
          id: string;
          opportunity_id: string;
          score: number;
          user_id: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string | null;
          id?: string;
          opportunity_id: string;
          score: number;
          user_id: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string | null;
          id?: string;
          opportunity_id?: string;
          score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          applicant_count: number | null;
          company: string | null;
          company_challenges: Json | null;
          company_industry: string | null;
          company_is_public: boolean | null;
          company_logo_url: string | null;
          company_recent_news: Json | null;
          company_researched_at: string | null;
          company_role_context: string | null;
          company_stock_ticker: string | null;
          company_url: string | null;
          created_at: string | null;
          description: string | null;
          description_html: string | null;
          easy_apply: boolean | null;
          embedding: string | null;
          employment_type: string | null;
          id: string;
          industries: string | null;
          job_function: string | null;
          location: string | null;
          normalized_url: string | null;
          posted_date: string | null;
          requirements: Json | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          seniority_level: string | null;
          source: string | null;
          status: string | null;
          title: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          applicant_count?: number | null;
          company?: string | null;
          company_challenges?: Json | null;
          company_industry?: string | null;
          company_is_public?: boolean | null;
          company_logo_url?: string | null;
          company_recent_news?: Json | null;
          company_researched_at?: string | null;
          company_role_context?: string | null;
          company_stock_ticker?: string | null;
          company_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          description_html?: string | null;
          easy_apply?: boolean | null;
          embedding?: string | null;
          employment_type?: string | null;
          id?: string;
          industries?: string | null;
          job_function?: string | null;
          location?: string | null;
          normalized_url?: string | null;
          posted_date?: string | null;
          requirements?: Json | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          seniority_level?: string | null;
          source?: string | null;
          status?: string | null;
          title: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          applicant_count?: number | null;
          company?: string | null;
          company_challenges?: Json | null;
          company_industry?: string | null;
          company_is_public?: boolean | null;
          company_logo_url?: string | null;
          company_recent_news?: Json | null;
          company_researched_at?: string | null;
          company_role_context?: string | null;
          company_stock_ticker?: string | null;
          company_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          description_html?: string | null;
          easy_apply?: boolean | null;
          embedding?: string | null;
          employment_type?: string | null;
          id?: string;
          industries?: string | null;
          job_function?: string | null;
          location?: string | null;
          normalized_url?: string | null;
          posted_date?: string | null;
          requirements?: Json | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          seniority_level?: string | null;
          source?: string | null;
          status?: string | null;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_notes: {
        Row: {
          created_at: string;
          id: string;
          links: Json;
          notes: string | null;
          opportunity_id: string;
          rating_company: number | null;
          rating_industry: number | null;
          rating_role_fit: number | null;
          rating_tech_stack: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          links?: Json;
          notes?: string | null;
          opportunity_id: string;
          rating_company?: number | null;
          rating_industry?: number | null;
          rating_role_fit?: number | null;
          rating_tech_stack?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          links?: Json;
          notes?: string | null;
          opportunity_id?: string;
          rating_company?: number | null;
          rating_industry?: number | null;
          rating_role_fit?: number | null;
          rating_tech_stack?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_notes_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          beta_code_used: string | null;
          created_at: string | null;
          email: string | null;
          github: string | null;
          id: string;
          identity_archetype: string | null;
          identity_bio: string | null;
          identity_generated_at: string | null;
          identity_headline: string | null;
          identity_keywords: Json | null;
          identity_matches: Json | null;
          linkedin: string | null;
          location: string | null;
          logo_url: string | null;
          name: string | null;
          phone: string | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          beta_code_used?: string | null;
          created_at?: string | null;
          email?: string | null;
          github?: string | null;
          id: string;
          identity_archetype?: string | null;
          identity_bio?: string | null;
          identity_generated_at?: string | null;
          identity_headline?: string | null;
          identity_keywords?: Json | null;
          identity_matches?: Json | null;
          linkedin?: string | null;
          location?: string | null;
          logo_url?: string | null;
          name?: string | null;
          phone?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          beta_code_used?: string | null;
          created_at?: string | null;
          email?: string | null;
          github?: string | null;
          id?: string;
          identity_archetype?: string | null;
          identity_bio?: string | null;
          identity_generated_at?: string | null;
          identity_headline?: string | null;
          identity_keywords?: Json | null;
          identity_matches?: Json | null;
          linkedin?: string | null;
          location?: string | null;
          logo_url?: string | null;
          name?: string | null;
          phone?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      recruiter_waitlist: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      shared_link_views: {
        Row: {
          id: string;
          shared_link_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          shared_link_id: string;
          viewed_at?: string;
        };
        Update: {
          id?: string;
          shared_link_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_link_views_shared_link_id_fkey";
            columns: ["shared_link_id"];
            isOneToOne: false;
            referencedRelation: "shared_links";
            referencedColumns: ["id"];
          },
        ];
      };
      shared_links: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          tailored_profile_id: string;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
          tailored_profile_id: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          tailored_profile_id?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_links_tailored_profile_id_fkey";
            columns: ["tailored_profile_id"];
            isOneToOne: true;
            referencedRelation: "tailored_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shared_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          plan_type: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_type?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_type?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tailored_profiles: {
        Row: {
          created_at: string;
          edited_fields: string[] | null;
          id: string;
          narrative: string | null;
          narrative_original: string | null;
          opportunity_id: string;
          resume_data: Json | null;
          resume_data_original: Json | null;
          talking_points: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          edited_fields?: string[] | null;
          id?: string;
          narrative?: string | null;
          narrative_original?: string | null;
          opportunity_id: string;
          resume_data?: Json | null;
          resume_data_original?: Json | null;
          talking_points: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          edited_fields?: string[] | null;
          id?: string;
          narrative?: string | null;
          narrative_original?: string | null;
          opportunity_id?: string;
          resume_data?: Json | null;
          resume_data_original?: Json | null;
          talking_points?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tailored_profiles_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      tailoring_eval_log: {
        Row: {
          created_at: string;
          eval_cost_cents: number | null;
          eval_model: string;
          gaps: Json | null;
          grounding_passed: boolean;
          hallucinations: Json | null;
          id: string;
          missed_opportunities: Json | null;
          passed: boolean;
          tailored_profile_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          eval_cost_cents?: number | null;
          eval_model: string;
          gaps?: Json | null;
          grounding_passed: boolean;
          hallucinations?: Json | null;
          id?: string;
          missed_opportunities?: Json | null;
          passed: boolean;
          tailored_profile_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          eval_cost_cents?: number | null;
          eval_model?: string;
          gaps?: Json | null;
          grounding_passed?: boolean;
          hallucinations?: Json | null;
          id?: string;
          missed_opportunities?: Json | null;
          passed?: boolean;
          tailored_profile_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tailoring_eval_log_tailored_profile_id_fkey";
            columns: ["tailored_profile_id"];
            isOneToOne: false;
            referencedRelation: "tailored_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tailoring_eval_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_tracking: {
        Row: {
          created_at: string | null;
          id: string;
          period_start: string;
          tailored_profiles_count: number;
          updated_at: string | null;
          uploads_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          period_start: string;
          tailored_profiles_count?: number;
          updated_at?: string | null;
          uploads_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          period_start?: string;
          tailored_profiles_count?: number;
          updated_at?: string | null;
          uploads_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      work_history: {
        Row: {
          company: string;
          company_domain: string | null;
          created_at: string;
          document_id: string;
          end_date: string | null;
          entry_type: string | null;
          id: string;
          location: string | null;
          order_index: number;
          start_date: string;
          summary: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          company: string;
          company_domain?: string | null;
          created_at?: string;
          document_id: string;
          end_date?: string | null;
          entry_type?: string | null;
          id?: string;
          location?: string | null;
          order_index?: number;
          start_date: string;
          summary?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          company?: string;
          company_domain?: string | null;
          created_at?: string;
          document_id?: string;
          end_date?: string | null;
          entry_type?: string | null;
          id?: string;
          location?: string | null;
          order_index?: number;
          start_date?: string;
          summary?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_history_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_beta_code: { Args: { input_code: string }; Returns: boolean };
      consume_beta_code: {
        Args: { input_code: string; user_id: string };
        Returns: boolean;
      };
      find_candidate_claims: {
        Args: {
          match_count?: number;
          match_user_id: string;
          query_embedding: string;
        };
        Returns: {
          confidence: number;
          description: string;
          id: string;
          label: string;
          similarity: number;
          type: string;
        }[];
      };
      find_relevant_claims_for_synthesis: {
        Args: {
          max_claims?: number;
          p_user_id: string;
          query_embedding: string;
          similarity_threshold?: number;
        };
        Returns: {
          confidence: number;
          description: string;
          id: string;
          label: string;
          similarity: number;
          type: string;
        }[];
      };
      get_current_period_start: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_or_create_usage: {
        Args: { p_user_id: string };
        Returns: {
          created_at: string | null;
          id: string;
          period_start: string;
          tailored_profiles_count: number;
          updated_at: string | null;
          uploads_count: number;
          user_id: string;
        };
      };
      get_shared_profile: { Args: { p_token: string }; Returns: Json };
      get_user_plan_type: { Args: { p_user_id: string }; Returns: string };
      increment_tailored_profiles_count: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      increment_upload_count: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      match_claims: {
        Args: {
          match_count: number;
          match_threshold: number;
          match_user_id: string;
          query_embedding: string;
        };
        Returns: {
          claim_type: string;
          evidence_text: string;
          id: string;
          similarity: number;
          value: Json;
        }[];
      };
      match_identity_claims: {
        Args: {
          match_count: number;
          match_threshold: number;
          match_user_id: string;
          query_embedding: string;
        };
        Returns: {
          confidence: number;
          description: string;
          id: string;
          label: string;
          similarity: number;
          type: string;
        }[];
      };
      upsert_waitlist: {
        Args: {
          p_email: string;
          p_source: string;
          p_interests: string[];
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;
