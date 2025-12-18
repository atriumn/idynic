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
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
