// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/doc-diagnostic
// Vérifie la chaîne du bon de commande SANS créer de vraie commande.
// Répond à « est-ce que ça va partir si j'appuie sur Mettre en traitement ? »
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type Check = { ok: boolean; label: string; detail?: string; fix?: string };

const BUYFACT_URL = (process.env.BUYFACT_URL ?? "https://buyfacturation-jdbf.vercel.app").replace(/\/$/, "");
const BUYFACT_KEY = process.env.BUYFACT_API_KEY ?? "";
const CORE_URL = (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const checks: Check[] = [];

  // 1. Quelle URL ce déploiement utilise-t-il réellement ? C'est la question
  //    qu'on ne peut pas trancher de l'extérieur.
  checks.push({
    ok: true,
    label: "URL buyfacturation utilisée",
    detail: BUYFACT_URL,
    fix: "Si ce n'est pas la bonne, pose BUYFACT_URL dans Coolify et redéploie.",
  });

  // 2. L'API répond-elle, et accepte-t-elle le type bon_commande ?
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`${BUYFACT_URL}/api/invoices?limit=1`, {
      signal: ctl.signal,
      headers: BUYFACT_KEY ? { "X-Api-Key": BUYFACT_KEY } : {},
    });
    clearTimeout(t);
    checks.push({
      ok: res.ok,
      label: "API buyfacturation joignable",
      detail: `HTTP ${res.status}`,
      fix: res.ok ? undefined : "Vérifie l'URL et le déploiement Vercel.",
    });
  } catch (e) {
    checks.push({
      ok: false,
      label: "API buyfacturation joignable",
      detail: (e as Error).message,
      fix: "URL injoignable depuis le serveur Camille.",
    });
  }

  // 3. Les colonnes qui mémorisent le document existent-elles ?
  try {
    await query("SELECT doc_number, doc_url FROM camille.orders LIMIT 1");
    checks.push({ ok: true, label: "Colonnes doc_number / doc_url", detail: "présentes" });
  } catch {
    checks.push({
      ok: false,
      label: "Colonnes doc_number / doc_url",
      detail: "absentes",
      fix: "Rejoue migration_orders.sql. Le PDF partira quand même, mais ne sera pas mémorisé.",
    });
  }

  // 4. camille-core, qui porte la session WhatsApp
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`${CORE_URL}/health`, { signal: ctl.signal });
    clearTimeout(t);
    checks.push({ ok: res.ok, label: "camille-core joignable", detail: `HTTP ${res.status}` });
  } catch (e) {
    checks.push({ ok: false, label: "camille-core joignable", detail: (e as Error).message });
  }

  // 5. Une session WhatsApp active est indispensable à l'envoi
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS n
         FROM camille.whatsapp_sessions ws
         JOIN camille.agents a ON a.id = ws.agent_id
        WHERE a.user_id = $1 AND COALESCE(ws.status,'') NOT IN ('STOPPED','FAILED')`,
      [user.id]
    );
    const n = r.rows[0]?.n ?? 0;
    checks.push({
      ok: n > 0,
      label: "Session WhatsApp active",
      detail: `${n} session(s)`,
      fix: n > 0 ? undefined : "Reconnecte WhatsApp depuis l'app : sans session, rien ne peut être envoyé.",
    });
  } catch (e) {
    checks.push({ ok: false, label: "Session WhatsApp active", detail: (e as Error).message });
  }

  return NextResponse.json({ ready: checks.every((c) => c.ok), checks });
}
