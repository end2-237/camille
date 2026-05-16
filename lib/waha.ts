// Waha API client — server-side only, never import in client components

const WAHA_URL     = process.env.WAHA_URL     ?? "https://waha.vps.buyticle.com";
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? "";
const N8N_WEBHOOK  = process.env.N8N_WEBHOOK_URL ?? "https://n8n.vps.buyticle.com/webhook/whatsapp-waha";

function wahaHeaders() {
  return { "Content-Type": "application/json", "X-Api-Key": WAHA_API_KEY };
}

export async function wahaCreateSession(sessionName: string) {
  const res = await fetch(`${WAHA_URL}/api/sessions`, {
    method: "POST",
    headers: wahaHeaders(),
    body: JSON.stringify({
      name: sessionName,
      config: {
        webhooks: [{
          url: N8N_WEBHOOK,
          events: ["message"],
          hmac: null,
        }],
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Waha createSession: ${res.status} ${text}`);
  }
  return res.json();
}

export async function wahaStartSession(sessionName: string) {
  const res = await fetch(`${WAHA_URL}/api/sessions/${sessionName}/start`, {
    method: "POST",
    headers: wahaHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Waha startSession: ${res.status} ${text}`);
  }
  return res.json();
}

export async function wahaGetSession(sessionName: string) {
  const res = await fetch(`${WAHA_URL}/api/sessions/${sessionName}`, {
    headers: wahaHeaders(),
  });
  // 404 = session inconnue, 422 = nom invalide → les deux = pas de session active
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) throw new Error(`Waha getSession: ${res.status}`);
  return res.json() as Promise<{ name: string; status: string; me?: { id: string; pushName: string } }>;
}

export async function wahaGetQR(sessionName: string): Promise<Buffer | null> {
  const res = await fetch(`${WAHA_URL}/api/sessions/${sessionName}/auth/qr?format=image`, {
    headers: { "X-Api-Key": WAHA_API_KEY },
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function wahaStopSession(sessionName: string) {
  await fetch(`${WAHA_URL}/api/sessions/${sessionName}/stop`, {
    method: "POST",
    headers: wahaHeaders(),
  });
}

export async function wahaDeleteSession(sessionName: string) {
  await fetch(`${WAHA_URL}/api/sessions/${sessionName}`, {
    method: "DELETE",
    headers: wahaHeaders(),
  });
}

export function makeSessionName(agentId: string) {
  // Waha Core (gratuit) = 1 seule session nommée "default"
  // Waha NEXT/PLUS (payant) = sessions multiples avec noms custom
  // Mettre WAHA_MULTI_SESSION=true dans .env pour activer le mode multi
  const multi = process.env.WAHA_MULTI_SESSION === "true";
  if (!multi) return "default";
  return `cam${agentId.replace(/-/g, "").slice(0, 12)}`;
}
