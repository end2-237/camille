// Camille Core API client — remplace WAHA, server-side only
// Les exports gardent les mêmes noms pour ne pas casser les routes existantes.

const CORE_URL     = process.env.CAMILLE_CORE_URL     ?? "https://camille-core.vps.buyticle.com";
const CORE_API_KEY = process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

function coreHeaders() {
  return { "Content-Type": "application/json", "X-Api-Key": CORE_API_KEY };
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

  // Camille Core status "CONNECTED" → WAHA équivalent "WORKING"
  const wahaStatus = data.status === "CONNECTED" ? "WORKING" : data.status;

  return {
    name:   data.name,
    status: wahaStatus,
    me:     data.phone ? { id: `${data.phone}@c.us`, pushName: "" } : undefined,
  };
}

// Récupère le QR code en base64 et le retourne sous forme de Buffer image
export async function wahaGetQR(sessionName: string): Promise<Buffer | null> {
  const res = await fetch(`${CORE_URL}/api/sessions/${sessionName}/qr`, {
    headers: coreHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json() as { qrCodeBase64?: string; status?: string };
  if (!data.qrCodeBase64) return null;

  // data URL → Buffer PNG
  const base64 = data.qrCodeBase64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64, "base64");
}

// Arrête une session sur Camille Core
export async function wahaStopSession(sessionName: string) {
  await fetch(`${CORE_URL}/api/sessions/${sessionName}/stop`, {
    method: "DELETE",
    headers: coreHeaders(),
  });
}

// Alias — Camille Core n'a qu'un seul endpoint stop
export async function wahaDeleteSession(sessionName: string) {
  return wahaStopSession(sessionName);
}

// Nom de session basé sur l'agentId — Camille Core supporte le multi-session nativement
export function makeSessionName(agentId: string) {
  const multi = process.env.WAHA_MULTI_SESSION !== "false"; // multi par défaut avec Camille Core
  if (!multi) return "default";
  return `cam${agentId.replace(/-/g, "").slice(0, 12)}`;
}
