import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getMaxLevel } from "@/lib/plans";
import { wahaSetWebhook } from "@/lib/waha";
import { getUserFromRequest } from "@/lib/auth-server";
import type {
  Agent, AgentStatus, AgentModel, BrandTone, SupportedLanguage,
  BusinessSector, AgentIdentity, BusinessContext, KnowledgeBase, AgentCapabilities,
} from "@/types/agent";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJ(val: any) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAgent(row: Record<string, any>): Agent {
  return {
    id: row.id,
    user_id: row.user_id,
    identity: {
      name: row.name,
      tagline: row.agent_tagline ?? undefined,
      brand_voice: row.brand_voice as BrandTone,
      primary_language: row.primary_language as SupportedLanguage,
      secondary_languages: parseJ(row.secondary_languages) ?? undefined,
      avatar_emoji: row.avatar_emoji ?? undefined,
    } satisfies AgentIdentity,
    business_context: {
      business_name: row.business_name,
      sector: row.sector as BusinessSector,
      description: row.description,
      website_url: row.website_url ?? undefined,
      location: row.location ?? undefined,
      target_audience: row.target_audience ?? undefined,
      owner_name: row.owner_name,
      owner_email: row.owner_email,
      whatsapp_number: row.whatsapp_number ?? undefined,
    } satisfies BusinessContext,
    knowledge_base: {
      business_description: row.description ?? "",
      products_services: row.products_services ?? undefined,
      pricing_info: row.pricing_info ?? undefined,
      business_hours: row.business_hours ?? undefined,
      policies: row.policies ?? undefined,
      faq: parseJ(row.faq) ?? [],
      forbidden_topics: parseJ(row.forbidden_topics) ?? [],
    } satisfies KnowledgeBase,
    capabilities: (parseJ(row.capabilities) ?? {}) as AgentCapabilities,
    system_prompt: {
      compiled_prompt: row.compiled_prompt ?? "",
      generated_at: row.updated_at,
      target_model: row.target_model as AgentModel,
      estimated_tokens: 0,
      version: 1,
    },
    status: row.status as AgentStatus,
    target_model: row.target_model as AgentModel,
    plan: (row.plan ?? "free") as Agent["plan"],
    google_calendar_email: row.google_calendar_email ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const ALLOWED_PATCH_FIELDS = new Set([
  "name", "agent_tagline", "brand_voice", "primary_language", "secondary_languages",
  "avatar_emoji", "business_name", "sector", "description", "website_url",
  "location", "target_audience", "owner_name", "owner_email", "whatsapp_number",
  "products_services", "pricing_info", "business_hours", "policies",
  "faq", "forbidden_topics", "capabilities", "target_model", "compiled_prompt", "status",
  "google_calendar_email",
  // ── Config Niveau 1 ──
  "level", "out_of_scope_behavior", "welcome_enabled", "welcome_message", "n8n_webhook_url",
  // ── Géo (sendLocation) ──
  "latitude", "longitude",
]);

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  try {
    const result = await query(
      "SELECT * FROM camille.agents WHERE id = $1 AND user_id = $2",
      [agentId, user.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }
    const row = result.rows[0];
    return NextResponse.json({
      agent: {
        ...rowToAgent(row),
        // Config N1/N2 exposée pour l'écran de réglages
        level: row.level ?? 1,
        out_of_scope_behavior: row.out_of_scope_behavior ?? "site",
        welcome_enabled: row.welcome_enabled !== false,
        welcome_message: row.welcome_message ?? null,
        latitude: row.latitude != null ? Number(row.latitude) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
      },
    });
  } catch (err) {
    console.error("[GET /api/agents/:id]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { agentId } = await params;
    const updates = await req.json();
    const flat: Record<string, unknown> = {};

    // ── Gating : le niveau ne peut pas dépasser ce que le plan autorise ──
    if (updates.level !== undefined) {
      const wanted = Number(updates.level);
      const planRow = await query(
        "SELECT plan FROM camille.agents WHERE id = $1 AND user_id = $2",
        [agentId, user.id]
      );
      const plan = planRow.rows[0]?.plan ?? "free";
      const max = getMaxLevel(plan);
      if (wanted > max) {
        return NextResponse.json(
          { error: `Le niveau ${wanted} nécessite un plan supérieur (votre plan « ${plan} » autorise jusqu'au niveau ${max}).`, code: "LEVEL_LOCKED", maxLevel: max, plan },
          { status: 403 }
        );
      }
    }

    // Flat scalar fields
    if (updates.status !== undefined)       flat.status = updates.status;
    if (updates.target_model !== undefined) flat.target_model = updates.target_model;

    // identity → flat columns
    if (updates.identity) {
      const id = updates.identity;
      if (id.name !== undefined)                flat.name = id.name;
      if (id.tagline !== undefined)             flat.agent_tagline = id.tagline;
      if (id.brand_voice !== undefined)         flat.brand_voice = id.brand_voice;
      if (id.primary_language !== undefined)    flat.primary_language = id.primary_language;
      if (id.secondary_languages !== undefined) flat.secondary_languages = JSON.stringify(id.secondary_languages);
      if (id.avatar_emoji !== undefined)        flat.avatar_emoji = id.avatar_emoji;
    }

    // business_context → flat columns
    if (updates.business_context) {
      const bc = updates.business_context;
      if (bc.business_name !== undefined)   flat.business_name = bc.business_name;
      if (bc.sector !== undefined)          flat.sector = bc.sector;
      if (bc.description !== undefined)     flat.description = bc.description;
      if (bc.website_url !== undefined)     flat.website_url = bc.website_url;
      if (bc.location !== undefined)        flat.location = bc.location;
      if (bc.target_audience !== undefined) flat.target_audience = bc.target_audience;
      if (bc.owner_name !== undefined)      flat.owner_name = bc.owner_name;
      if (bc.owner_email !== undefined)     flat.owner_email = bc.owner_email;
      if (bc.whatsapp_number !== undefined) flat.whatsapp_number = bc.whatsapp_number;
    }

    // knowledge_base → flat columns
    if (updates.knowledge_base) {
      const kb = updates.knowledge_base;
      if (kb.business_description !== undefined) flat.description = kb.business_description;
      if (kb.products_services !== undefined)    flat.products_services = kb.products_services;
      if (kb.pricing_info !== undefined)         flat.pricing_info = kb.pricing_info;
      if (kb.business_hours !== undefined)       flat.business_hours = kb.business_hours;
      if (kb.policies !== undefined)             flat.policies = kb.policies;
      if (kb.faq !== undefined)                  flat.faq = JSON.stringify(kb.faq);
      if (kb.forbidden_topics !== undefined)     flat.forbidden_topics = JSON.stringify(kb.forbidden_topics);
    }

    // capabilities → text column (JSON stringified)
    if (updates.capabilities !== undefined) {
      flat.capabilities = JSON.stringify(updates.capabilities);
    }

    // system_prompt → compiled_prompt column
    if (updates.system_prompt !== undefined) {
      flat.compiled_prompt = updates.system_prompt.compiled_prompt ?? "";
      if (updates.system_prompt.target_model) flat.target_model = updates.system_prompt.target_model;
    }

    // Raw flat fields (fallback for direct top-level fields)
    for (const [k, v] of Object.entries(updates)) {
      if (ALLOWED_PATCH_FIELDS.has(k) && flat[k] === undefined) flat[k] = v;
    }

    const filtered = Object.entries(flat).filter(([key]) => ALLOWED_PATCH_FIELDS.has(key));
    if (filtered.length === 0) {
      return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 });
    }

    const setClauses = filtered.map(([key], i) => `"${key}" = $${i + 3}`).join(", ");
    const values = filtered.map(([, val]) =>
      typeof val === "object" && val !== null ? JSON.stringify(val) : val
    );

    console.log("[PATCH /api/agents/:id] SQL:", `UPDATE camille.agents SET ${setClauses}, updated_at = NOW() WHERE id = $1 AND user_id = $2`);
    console.log("[PATCH /api/agents/:id] params:", [agentId, user.id, ...values]);

    const result = await query(
      `UPDATE camille.agents
       SET ${setClauses}, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [agentId, user.id, ...values]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable ou accès refusé" }, { status: 404 });
    }

    // ── Auto-config du webhook si le niveau ou le webhook perso a changé ──
    //   → chaque session de l'agent pointe vers le bon workflow (N1/N2/N3),
    //     ou vers le webhook personnalisé (clients « sur devis »). Zéro manuel.
    if (updates.level !== undefined || updates.n8n_webhook_url !== undefined) {
      try {
        const agentRow = result.rows[0];
        const lvl = Number(agentRow.level ?? 1);
        const customUrl = agentRow.n8n_webhook_url ?? null;
        const sess = await query(
          "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1",
          [agentId]
        );
        await Promise.all(
          sess.rows.map((s: { session_name: string }) => wahaSetWebhook(s.session_name, customUrl, lvl))
        );
      } catch (e) {
        console.error("[PATCH] auto-webhook:", e);
      }
    }

    return NextResponse.json({ agent: rowToAgent(result.rows[0]) });
  } catch (err) {
    console.error("[PATCH /api/agents/:id] FULL ERROR:", err);
    // Expose le message réel pour debug (à retirer en prod)
    const msg = err instanceof Error
      ? `${err.message}${(err as NodeJS.ErrnoException).code ? ` [${(err as NodeJS.ErrnoException).code}]` : ""}`
      : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  try {
    const result = await query(
      `UPDATE camille.agents SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [agentId, user.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
