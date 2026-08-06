// Camille Core API client — remplace WAHA, server-side only
// Les exports gardent les mêmes noms pour ne pas casser les routes existantes.

const CORE_URL     = process.env.CAMILLE_CORE_URL     ?? "https://camille-core.vps.buyticle.com";
const CORE_API_KEY = process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

function coreHeaders() {
  return { "Content-Type": "application/json", "X-Api-Key": CORE_API_KEY };
}

/**
 * Auto-configure le webhook n8n d'une session côté Camille Core.
 * URL = webhook propre à l'agent, sinon le template global du NIVEAU de l'agent
 * (N8N_N1/N2/N3_WEBHOOK_URL). Idempotent, silencieux en cas d'échec.
 */
export async function wahaSetWebhook(sessionName: string, url?: string | null, level: number = 1) {
  const levelDefault =
    level === 3 ? process.env.N8N_N3_WEBHOOK_URL :
    level === 2 ? process.env.N8N_N2_WEBHOOK_URL :
                  process.env.N8N_N1_WEBHOOK_URL;
  const target = (url && url.trim()) || levelDefault || process.env.N8N_N1_WEBHOOK_URL || "";
  if (!target) return; // rien à configurer
  try {
    await fetch(`${CORE_URL}/api/config/webhooks`, {
      method: "POST",
      headers: coreHeaders(),
      body: JSON.stringify({ session: sessionName, url: target }),
    });
  } catch (e) {
    console.error("[waha] setWebhook error:", e);
  }
}

// Crée ET démarre une session (Camille Core fait les deux en un seul appel)
export async function wahaCreateSession(sessionName: string) {
  const res = await fetch(`${CORE_URL}/api/sessions/start`, {
    method: "POST",
    headers: coreHeaders(),
    body: JSON.stringify({ name: sessionName }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Core createSession: ${res.status} ${text}`);
  return data;
}

// Alias — Camille Core n'a pas de "start" séparé, on réutilise le même appel
export async function wahaStartSession(sessionName: string) {
  return wahaCreateSession(sessionName);
}

// Récupère le statut d'une session — retourne null si introuvable
// Map des statuts Camille Core → format compatible avec l'ancien code WAHA
export async function wahaGetSession(sessionName: string): Promise<{
  name: string;
  status: string;
  me?: { id: string; pushName: string };
} | null> {
  const res = await fetch(`${CORE_URL}/api/sessions/${sessionName}/status`, {
    headers: coreHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json() as { name: string; status: string; phone?: string | null };

  // Mapping statuts Camille Core → statuts WAHA attendus par le dashboard
  const STATUS_MAP: Record<string, string> = {
    CONNECTED:     "WORKING",
    QR_READY:      "SCAN_QR_CODE",
    INITIALIZING:  "STARTING",
    AUTHENTICATED: "STARTING",
    DISCONNECTED:  "STOPPED",
    AUTH_FAILURE:  "FAILED",
    ERROR:         "ERROR",
  };
  const wahaStatus = STATUS_MAP[data.status] ?? data.status;

  return {
    name:   data.name,
    status: wahaStatus,
    me:     data.phone ? { id: `${data.phone}@c.us`, pushName: "" } : undefined,
  };
}

/**
 * Récupère le QR code de la session.
 *
 * On rend AUSSI l'état et le message du core, pas seulement l'image. Sans eux,
 * l'appelant ne peut pas distinguer « le QR n'est pas encore prêt » de « la
 * session est en reconnexion » ni de « la session n'existe pas » — trois
 * situations qui appellent trois réponses différentes, et qui se présentaient
 * jusqu'ici comme une seule et même absence d'image.
 */
export async function wahaGetQR(sessionName: string): Promise<{
  buffer: Buffer | null;
  dataUrl: string | null;
  coreStatus: string | null;
  message: string | null;
}> {
  const vide = { buffer: null, dataUrl: null, coreStatus: null, message: null };

  let res: Response;
  try {
    res = await fetch(`${CORE_URL}/api/sessions/${sessionName}/qr`, { headers: coreHeaders() });
  } catch (e) {
    return { ...vide, message: `Service WhatsApp injoignable (${(e as Error).message})` };
  }

  const texte = await res.text();
  let data: { qrCodeBase64?: string; status?: string; message?: string; error?: string } = {};
  try { data = texte ? JSON.parse(texte) : {}; } catch { /* réponse non JSON */ }

  if (!res.ok) {
    return { ...vide, coreStatus: data.status ?? null, message: data.error ?? `Camille Core ${res.status}` };
  }
  if (!data.qrCodeBase64) {
    return { ...vide, coreStatus: data.status ?? null, message: data.message ?? null };
  }

  const base64 = data.qrCodeBase64.replace(/^data:image\/\w+;base64,/, "");
  return {
    buffer: Buffer.from(base64, "base64"),
    dataUrl: `data:image/png;base64,${base64}`,
    coreStatus: data.status ?? null,
    message: null,
  };
}

// Arrête une session ET efface les fichiers d'auth (permet de connecter un autre numéro)
export async function wahaStopSession(sessionName: string) {
  await fetch(`${CORE_URL}/api/sessions/${sessionName}/reset`, {
    method: "DELETE",
    headers: coreHeaders(),
  });
}

// Alias
export async function wahaDeleteSession(sessionName: string) {
  return wahaStopSession(sessionName);
}

/**
 * Code de couplage : la connexion par numéro, sans scanner de QR.
 *
 * Camille Core répond de deux façons, et les deux sont normales :
 *   { code }     le code à saisir dans WhatsApp, il expire vite
 *   { message }  le numéro est enregistré mais le socket n'est pas encore prêt ;
 *                le code sortira au prochain cycle de connexion
 *
 * On rend donc les deux au lieu de traiter le second cas comme une panne : un
 * « code non reçu » ferait recommencer le vendeur alors qu'il n'a qu'à attendre
 * quelques secondes.
 */
export async function wahaPairingCode(
  sessionName: string,
  phone: string
): Promise<{ code: string | null; message: string | null }> {
  const res = await fetch(`${CORE_URL}/api/sessions/${sessionName}/pairing-code`, {
    method: "POST",
    headers: coreHeaders(),
    body: JSON.stringify({ phone }),
  });
  const texte = await res.text();
  let data: { code?: string; message?: string; error?: string } = {};
  try { data = texte ? JSON.parse(texte) : {}; } catch { /* réponse non JSON */ }

  if (!res.ok) {
    throw new Error(data.error || `Camille Core ${res.status}${texte ? ` — ${texte.slice(0, 200)}` : ""}`);
  }
  return { code: data.code ?? null, message: data.message ?? null };
}

// Analytics Camille Core : nombre de messages REÇUS (et contacts uniques) sur une période.
// Camille Core compte chaque message entrant, y compris ceux que l'IA n'a pas traités —
// c'est la seule source fiable du "nombre de messages reçus".
export async function wahaAnalytics(
  sessionName: string,
  fromMs: number,
  toMs: number
): Promise<{ messages: number; conversations: number } | null> {
  try {
    const url = `${CORE_URL}/api/analytics?session=${encodeURIComponent(sessionName)}&from=${fromMs}&to=${toMs}&granularity=day`;
    const res = await fetch(url, { headers: coreHeaders() });
    if (!res.ok) return null;
    const data = (await res.json()) as { totals?: { messages?: number; conversations?: number } };
    return {
      messages: Number(data?.totals?.messages ?? 0),
      conversations: Number(data?.totals?.conversations ?? 0),
    };
  } catch {
    return null; // Camille Core injoignable → on n'empêche pas les stats de s'afficher
  }
}

// Nom de session basé sur l'agentId — Camille Core supporte le multi-session nativement
export function makeSessionName(agentId: string) {
  const multi = process.env.WAHA_MULTI_SESSION !== "false"; // multi par défaut avec Camille Core
  if (!multi) return "default";
  return `cam${agentId.replace(/-/g, "").slice(0, 12)}`;
}
