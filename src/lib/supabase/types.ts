export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
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
      };
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
    Enums: Record<string, never>;
  };
}
