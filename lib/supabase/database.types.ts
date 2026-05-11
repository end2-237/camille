// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/database.types.ts — Camille by Buyticle
// Auto-typed Supabase database interface.
// Regenerate with: npx supabase gen types typescript --local > lib/supabase/database.types.ts
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Agent,
  AgentStatus,
  AgentModel,
} from "@/types/agent";

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          user_id: string;
          identity: Agent["identity"];
          business_context: Agent["business_context"];
          knowledge_base: Agent["knowledge_base"];
          capabilities: Agent["capabilities"];
          whatsapp_config: Agent["whatsapp_config"] | null;
          system_prompt: Agent["system_prompt"];
          status: AgentStatus;
          target_model: AgentModel;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agents"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["agents"]["Insert"]>;
      };

      agent_conversations: {
        Row: {
          id: string;
          agent_id: string;
          user_phone_hash: string;
          messages: Array<{ role: "user" | "assistant"; content: string }>;
          started_at: string;
          last_message_at: string;
          is_active: boolean;
          total_tokens_used: number;
        };
        Insert: Omit<Database["public"]["Tables"]["agent_conversations"]["Row"],
          "id" | "started_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["agent_conversations"]["Insert"]>;
      };

      agent_knowledge_documents: {
        Row: {
          id: string;
          agent_id: string;
          title: string;
          content: string;
          source_url: string | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agent_knowledge_documents"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["agent_knowledge_documents"]["Insert"]>;
      };

      agent_analytics: {
        Row: {
          id: string;
          agent_id: string;
          date: string;
          messages_handled: number;
          leads_captured: number;
          escalations: number;
          avg_response_ms: number | null;
          tokens_consumed: number;
        };
        Insert: Omit<Database["public"]["Tables"]["agent_analytics"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["agent_analytics"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      agent_status: AgentStatus;
      agent_model: AgentModel;
    };
  };
}
