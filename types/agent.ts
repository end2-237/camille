// ─────────────────────────────────────────────────────────────────────────────
// types/agent.ts — Camille by Buyticle
// Central type definitions consumed by the configurator, prompt engine,
// Supabase layer, and WhatsApp integration pipeline.
// ─────────────────────────────────────────────────────────────────────────────

// ── Primitives ────────────────────────────────────────────────────────────────

export type UUID = string;
export type ISODateString = string;

export type AgentStatus = "draft" | "active" | "paused" | "archived";

export type SupportedLanguage =
  | "fr"
  | "en"
  | "es"
  | "ar"
  | "pt"
  | "de"
  | "it"
  | "nl";

export type BrandTone =
  | "professional"
  | "friendly"
  | "casual"
  | "luxury"
  | "technical"
  | "empathetic"
  | "authoritative";

export type BusinessSector =
  | "ecommerce"
  | "hospitality"
  | "healthcare"
  | "finance"
  | "education"
  | "real_estate"
  | "legal"
  | "beauty_wellness"
  | "food_beverage"
  | "tech_saas"
  | "consulting"
  | "nonprofit"
  | "other";

export type AgentModel =
  // Groq — disponibles
  | "llama-3.1-8b-instant"
  | "llama-3.3-70b-versatile"
  | "mixtral-8x7b-32768"
  // OpenAI — bientôt
  | "gpt-4o"
  | "gpt-4o-mini"
  // Anthropic — bientôt
  | "claude-3-5-sonnet-20241022"
  | "claude-3-haiku-20240307";

// ── Identity ──────────────────────────────────────────────────────────────────

/** Agent's public-facing personality and voice */
export interface AgentIdentity {
  /** Human-readable display name (e.g. "Aria de La Belle Époque") */
  name: string;

  /** Short tagline shown on card previews */
  tagline?: string;

  /** The brand voice tone driving prompt personality */
  brand_voice: BrandTone;

  /** Primary response language */
  primary_language: SupportedLanguage;

  /** Optional secondary languages the agent can switch to */
  secondary_languages?: SupportedLanguage[];

  /** Emoji or initials used as avatar fallback */
  avatar_emoji?: string;

  /** URL to uploaded avatar image (stored in Supabase Storage) */
  avatar_url?: string;
}

// ── Owner / Business Context ───────────────────────────────────────────────────

/** The human or organisation that owns and configures this agent */
export interface BusinessContext {
  /** Legal or trade name of the business */
  business_name: string;

  /** Industry vertical */
  sector: BusinessSector;

  /** One-sentence description of the business */
  description: string;

  /** Website URL for contextual grounding */
  website_url?: string;

  /** Physical or virtual location */
  location?: string;

  /** Target customer persona description */
  target_audience?: string;

  /** Business owner / admin full name */
  owner_name: string;

  /** Contact email for notifications and billing */
  owner_email: string;

  /** WhatsApp business number (E.164 format: +33612345678) */
  whatsapp_number?: string;
}

// ── Knowledge Base ─────────────────────────────────────────────────────────────

/** A single FAQ entry injected into the system prompt */
export interface FAQEntry {
  question: string;
  answer: string;
}

/** A named document / URL chunk the agent can reference */
export interface KnowledgeDocument {
  id: UUID;
  title: string;
  content: string;
  source_url?: string;
  created_at: ISODateString;
}

/** The structured knowledge fed into the agent's context window */
export interface KnowledgeBase {
  /** Top-level business information string */
  business_description: string;

  /** Products or services offered */
  products_services?: string;

  /** Pricing tiers or ranges */
  pricing_info?: string;

  /** Business hours (free text, e.g. "Mon-Fri 9h-18h CET") */
  business_hours?: string;

  /** Policies: returns, cancellations, guarantees */
  policies?: string;

  /** Structured FAQ entries */
  faq?: FAQEntry[];

  /** Attached knowledge documents */
  documents?: KnowledgeDocument[];

  /** Topics the agent must NEVER discuss */
  forbidden_topics?: string[];
}

// ── Capabilities ──────────────────────────────────────────────────────────────

/** Feature flags toggled per agent in the configurator */
export interface AgentCapabilities {
  /** Handle inbound WhatsApp messages with auto-reply */
  support_whatsapp: boolean;

  /** Generate social posts, captions, newsletters */
  content_generation: boolean;

  /** Produce or suggest AI images (via DALL-E / Stable Diffusion) */
  image_creation: boolean;

  /** Schedule and publish social media content */
  community_management: boolean;

  /** Provide strategic recommendations and analytics summaries */
  strategy_advisor: boolean;

  /** Capture leads and push them to a CRM */
  lead_capture: boolean;

  /** Send proactive follow-up or broadcast messages */
  proactive_messaging: boolean;

  /** Book appointments and sync with Google Calendar */
  calendar_booking: boolean;

  /**
   * URL of the welcome voice note (.ogg / .mp3) sent to new contacts.
   * If null / empty, no audio is sent in the welcome sequence.
   */
  welcome_audio_url?: string | null;

  /**
   * URL of the welcome video (.mp4) sent to new contacts after the audio.
   * If null / empty, no video is sent in the welcome sequence.
   */
  welcome_video_url?: string | null;
}

// ── WhatsApp Integration ──────────────────────────────────────────────────────

/** Runtime config consumed by the WhatsApp webhook handler */
export interface WhatsAppConfig {
  /** Meta phone number ID */
  phone_number_id: string;

  /** Meta WABA (WhatsApp Business Account) ID */
  waba_id: string;

  /** Encrypted access token (never stored in plaintext) */
  access_token_ref: string;

  /** Webhook verify token */
  webhook_token: string;

  /** Whether the integration is live */
  is_active: boolean;

  /** Conversation timeout before a new session starts (minutes) */
  session_timeout_minutes: number;

  /** Max tokens per response to keep messages concise */
  max_response_tokens: number;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

/** The auto-generated instruction block sent to the LLM as system context */
export interface SystemPromptConfig {
  /** The final compiled prompt string */
  compiled_prompt: string;

  /** ISO timestamp of last regeneration */
  generated_at: ISODateString;

  /** Underlying LLM model targeted */
  target_model: AgentModel;

  /** Approximate token count of the compiled prompt */
  estimated_tokens: number;

  /** Version counter incremented on each edit */
  version: number;
}

// ── Configurator Form State ────────────────────────────────────────────────────

/** The raw data shape collected across all stepper form steps */
export interface AgentFormData {
  // Step 1 – Business Identity
  business_name: string;
  owner_name: string;
  owner_email: string;
  whatsapp_number?: string;
  sector: BusinessSector;
  description: string;
  website_url?: string;
  location?: string;
  target_audience?: string;

  // Step 2 – Agent Personality
  agent_name: string;
  agent_tagline?: string;
  brand_voice: BrandTone;
  primary_language: SupportedLanguage;
  secondary_languages?: SupportedLanguage[];
  avatar_emoji?: string;

  // Step 3 – Knowledge Base
  products_services?: string;
  pricing_info?: string;
  business_hours?: string;
  policies?: string;
  faq?: FAQEntry[];
  forbidden_topics?: string[];

  // Step 4 – Capabilities
  capabilities: AgentCapabilities;

  // Step 5 – Model & Review
  target_model: AgentModel;
}

// ── Full Agent Entity ─────────────────────────────────────────────────────────

/** The complete persisted agent record stored in Supabase */
export interface Agent {
  id: UUID;
  user_id: UUID;

  identity: AgentIdentity;
  business_context: BusinessContext;
  knowledge_base: KnowledgeBase;
  capabilities: AgentCapabilities;
  whatsapp_config?: WhatsAppConfig;
  system_prompt: SystemPromptConfig;

  status: AgentStatus;
  target_model: AgentModel;
  plan: "free" | "starter" | "pro" | "enterprise";

  /** Google Calendar OAuth — email shown in dashboard when connected */
  google_calendar_email?: string | null;

  /**
   * Owner mode — bcrypt hash of the WhatsApp password for /password authentication.
   * Only the existence (truthy/falsy) is exposed to the frontend — never the hash itself.
   */
  owner_password_hash?: string | null;

  created_at: ISODateString;
  updated_at: ISODateString;
}

// ── API Payloads ──────────────────────────────────────────────────────────────

export type CreateAgentPayload = Omit<
  Agent,
  "id" | "created_at" | "updated_at" | "system_prompt"
>;

export type UpdateAgentPayload = Partial<
  Omit<Agent, "id" | "user_id" | "created_at">
>;

// ── Step Metadata (Stepper UI) ────────────────────────────────────────────────

export interface StepMeta {
  id: number;
  title: string;
  description: string;
  icon: string;
}

export const STEPPER_STEPS: StepMeta[] = [
  {
    id: 1,
    title: "Votre Entreprise",
    description: "Identité et coordonnées",
    icon: "Building2",
  },
  {
    id: 2,
    title: "Personnalité Agent",
    description: "Nom, voix et langue",
    icon: "Bot",
  },
  {
    id: 3,
    title: "Base de Connaissance",
    description: "Produits, FAQ, politiques",
    icon: "BookOpen",
  },
  {
    id: 4,
    title: "Capacités",
    description: "Fonctionnalités activées",
    icon: "Zap",
  },
  {
    id: 5,
    title: "Modèle & Revue",
    description: "Finaliser et générer",
    icon: "Sparkles",
  },
];
