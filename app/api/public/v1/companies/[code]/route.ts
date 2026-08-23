// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/v1/companies/{code}
//
// Le site demande : « ce code existe-t-il, et de quelle entreprise s'agit-il ? »
// C'est ce qui permet à un employé de saisir le code de sa société et de voir
// immédiatement à quel compte sa commande sera rattachée — avant de commander,
// pas après.
//
//   curl .../api/public/v1/companies/ENK-7K2M -H "X-Camille-Key: cam_sk_xxxxx"
//
// Clé SECRÈTE obligatoire. Un code est court, donc devinable : avec une clé
// utilisable depuis un navigateur, n'importe qui pourrait balayer l'alphabet et
// lire le nom et la provision des entreprises clientes. Le site interroge donc
// depuis SON serveur, comme il le fait déjà pour créer une commande.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { authenticate, json, preflight } from "@/lib/publicApi";
import { findByCode, publicView } from "@/lib/companyAccounts";

type RouteContext = { params: Promise<{ code: string }> };

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await authenticate(req, "secret");
  if ("error" in auth) return auth.error;

  const { code } = await params;

  let account;
  try {
    account = await findByCode(auth.key.agent_id, code);
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") {
      return json(
        { error: "Comptes entreprise non installés — applique migration_company_accounts.sql" },
        503, req
      );
    }
    throw e;
  }

  // Un code inconnu n'est pas une erreur du site : c'est une faute de frappe de
  // l'employé. On répond 404 avec de quoi le lui dire simplement.
  if (!account) {
    return json({ found: false, error: "Code entreprise inconnu." }, 404, req);
  }

  return json({ found: true, company: await publicView(account) }, 200, req);
}
