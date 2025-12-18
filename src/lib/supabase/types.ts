export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          type: "resume" | "story";
          filename: string | null;
          storage_path: string | null;
          raw_text: string | null;
          content_hash: string | null;
          status: "pending" | "processing" | "completed" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "resume" | "story";
          filename?: string | null;
          storage_path?: string | null;
          raw_text?: string | null;
          content_hash?: string | null;
          status?: "pending" | "processing" | "completed" | "failed";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "resume" | "story";
          filename?: string | null;
          storage_path?: string | null;
          raw_text?: string | null;
          content_hash?: string | null;
          status?: "pending" | "processing" | "completed" | "failed";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      claims: {
        Row: {
          id: string;
          user_id: string;
          document_id: string | null;
          claim_type: string;
          value: Json;
          evidence_text: string | null;
          confidence: number;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id?: string | null;
          claim_type: string;
          value: Json;
          evidence_text?: string | null;
          confidence?: number;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_id?: string | null;
          claim_type?: string;
          value?: Json;
          evidence_text?: string | null;
          confidence?: number;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          }
        ];
      };
      evidence: {
        Row: {
          id: string;
          user_id: string;
          document_id: string | null;
          evidence_type: "accomplishment" | "skill_listed" | "trait_indicator";
          text: string;
          context: Json | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id?: string | null;
          evidence_type: "accomplishment" | "skill_listed" | "trait_indicator";
          text: string;
          context?: Json | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_id?: string | null;
          evidence_type?: "accomplishment" | "skill_listed" | "trait_indicator";
          text?: string;
          context?: Json | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          }
        ];
      };
      identity_claims: {
        Row: {
          id: string;
          user_id: string;
          type: "skill" | "achievement" | "attribute";
          label: string;
          description: string | null;
          confidence: number;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "skill" | "achievement" | "attribute";
          label: string;
          description?: string | null;
          confidence?: number;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "skill" | "achievement" | "attribute";
          label?: string;
          description?: string | null;
          confidence?: number;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "identity_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      claim_evidence: {
        Row: {
          id: string;
          claim_id: string;
          evidence_id: string;
          strength: "weak" | "medium" | "strong";
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          evidence_id: string;
          strength: "weak" | "medium" | "strong";
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          evidence_id?: string;
          strength?: "weak" | "medium" | "strong";
          created_at?: string;
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
          }
        ];
      };
      opportunities: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          company: string | null;
          url: string | null;
          description: string | null;
          requirements: Json | null;
          status:
            | "tracking"
            | "applied"
            | "interviewing"
            | "offer"
            | "rejected"
            | "archived";
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          company?: string | null;
          url?: string | null;
          description?: string | null;
          requirements?: Json | null;
          status?:
            | "tracking"
            | "applied"
            | "interviewing"
            | "offer"
            | "rejected"
            | "archived";
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          company?: string | null;
          url?: string | null;
          description?: string | null;
          requirements?: Json | null;
          status?:
            | "tracking"
            | "applied"
            | "interviewing"
            | "offer"
            | "rejected"
            | "archived";
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      matches: {
        Row: {
          id: string;
          user_id: string;
          opportunity_id: string;
          claim_id: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          opportunity_id: string;
          claim_id: string;
          score: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          opportunity_id?: string;
          claim_id?: string;
          score?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
            foreignKeyName: "matches_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_claims: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          id: string;
          claim_type: string;
          value: Json;
          evidence_text: string | null;
          similarity: number;
        }[];
      };
      match_identity_claims: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          id: string;
          type: string;
          label: string;
          description: string | null;
          confidence: number;
          similarity: number;
        }[];
      };
      find_candidate_claims: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_count?: number;
        };
        Returns: {
          id: string;
          type: string;
          label: string;
          description: string | null;
          confidence: number;
          similarity: number;
        }[];
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
