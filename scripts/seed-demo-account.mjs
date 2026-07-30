#!/usr/bin/env node
/**
 * Crée le compte de démonstration destiné aux relecteurs de Google Play.
 *
 * L'application exige une connexion : sans identifiants, Google rejette pour
 * « impossible d'évaluer l'application ». Un compte vide ne vaut guère mieux —
 * le relecteur voit des écrans vides et se demande si l'app fonctionne. Ce
 * script monte donc un compte déjà peuplé : un agent, un catalogue, et des
 * commandes à tous les stades.
 *
 * Tout passe par l'API publique de Camille, comme le ferait un utilisateur :
 * aucun accès direct à la base, donc exécutable depuis n'importe où.
 *
 *   node scripts/seed-demo-account.mjs
 *   node scripts/seed-demo-account.mjs --url https://camille.vps.buyticle.com
 *
 * Le script est rejouable : si le compte existe déjà, il se connecte au lieu
 * d'échouer, et n'ajoute que ce qui manque.
 */

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const BASE = arg("url", "https://camille.vps.buyticle.com").replace(/\/$/, "");
const EMAIL = arg("email", "demo.play@buyticle.com");
const PASSWORD = arg("password", "CamilleDemo2026!");

// ─── Contenu de la démo ──────────────────────────────────────────────────────
// Un restaurant : c'est le secteur qui montre le plus de fonctions (carte du
// menu, service sur place / à emporter / livraison, frais par quartier).

const AGENT = {
  agent_name: "Camille",
  agent_tagline: "Le vendeur de Chez Mado",
  brand_voice: "friendly",
  primary_language: "fr",
  avatar_emoji: "🍔",
  business_name: "Chez Mado (démo)",
  sector: "food_beverage",
  description:
    "Restaurant de démonstration : grillades, burgers et jus frais à Douala. " +
    "Compte de démonstration destiné à l'évaluation de l'application.",
  location: "Bonamoussadi, Douala — Cameroun",
  owner_name: "Mado",
  owner_email: "demo.play@buyticle.com",
  whatsapp_number: "237600000000",
  business_hours: "Tous les jours, 10h — 23h",
  target_audience: "Habitants de Douala",
  // target_model appartient à formData, pas à systemPrompt : la colonne est
  // NOT NULL en base, et l'omettre fait échouer la création.
  target_model: "llama-3.3-70b-versatile",
};

const PRODUCTS = [
  { name: "Poulet braisé", description: "Poulet entier braisé, sauce maison", price: 4500, category: "Grillades", stock: 20 },
  { name: "Burger Mado", description: "Steak, cheddar, sauce signature", price: 2500, category: "Burgers", stock: 35 },
  { name: "Poisson braisé", description: "Bar entier, plantain, piment vert", price: 5000, category: "Grillades", stock: 12 },
  { name: "Nuggets 9 pièces", description: "Panés maison, sauce au choix", price: 2000, category: "Snacks", stock: 40 },
  { name: "Frites maison", description: "Pommes fraîches, coupées à la main", price: 1000, category: "Snacks", stock: 60 },
  { name: "Jus de gingembre", description: "Pressé du jour, 50 cl", price: 1000, category: "Boissons", stock: 25 },
  { name: "Sucrerie 33 cl", description: "Coca, Fanta, Sprite", price: 700, category: "Boissons", stock: 80 },
];

// Commandes à des stades différents : le relecteur doit voir un écran vivant,
// pas une liste d'éléments identiques.
const ORDERS = [
  {
    items: [{ name: "Poulet braisé", qty: 1 }, { name: "Frites maison", qty: 2 }],
    customer: { name: "Client démo 1", phone: "237600000001" },
    delivery: { address: "Makepe, face pharmacie", lat: 4.0836, lng: 9.7513 },
    note: "En livraison",
  },
  {
    items: [{ name: "Burger Mado", qty: 2 }, { name: "Jus de gingembre", qty: 2 }],
    customer: { name: "Client démo 2", phone: "237600000002" },
    delivery: { address: "Bonamoussadi, carrefour Maison Blanche", lat: 4.0921, lng: 9.7402 },
    note: "À emporter",
  },
  {
    items: [{ name: "Poisson braisé", qty: 1 }, { name: "Sucrerie 33 cl", qty: 3 }],
    customer: { name: "Client démo 3", phone: "237600000003" },
    delivery: { address: "Akwa, rue Joss" },
    note: "Sur place",
  },
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────

async function call(path, { method = "GET", token, key, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers["X-Camille-Key"] = key;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.raw?.slice(0, 200) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

const step = (m) => console.log(`\n▸ ${m}`);
const ok = (m) => console.log(`  ✓ ${m}`);

// ─── Déroulé ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Instance : ${BASE}`);
  console.log(`Compte   : ${EMAIL}`);

  // 1. Compte — on tolère qu'il existe déjà pour que le script soit rejouable.
  step("Compte");
  let token;
  try {
    const r = await call("/api/auth/register", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD, full_name: "Compte de démonstration" },
    });
    token = r.token;
    ok("créé");
  } catch (e) {
    if (e.status !== 409) throw e;
    const r = await call("/api/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });
    token = r.token;
    ok("déjà existant — connecté");
  }

  // 2. Agent
  step("Agent");
  const existing = await call("/api/agents", { token });
  const agents = existing.agents || existing || [];
  let agentId = agents.find?.((a) => a?.business_context?.business_name === AGENT.business_name)?.id;

  if (agentId) {
    ok(`déjà présent (${agentId.slice(0, 8)})`);
  } else {
    const created = await call("/api/agents", {
      method: "POST",
      token,
      body: {
        formData: AGENT,
        systemPrompt: {
          compiled_prompt:
            `Tu es Camille, le vendeur de ${AGENT.business_name}. ` +
            `Tu présentes les plats, prends les commandes et restes bref et chaleureux.`,
        },
      },
    });
    agentId = created.agent?.id || created.id;
    ok(`créé (${String(agentId).slice(0, 8)})`);
  }

  // 3. Activation — un agent naît en « draft », et l'API publique refuse alors
  // toute commande. Sans cette étape, le relecteur verrait un écran vide.
  step("Activation");
  await call(`/api/agents/${agentId}`, { method: "PATCH", token, body: { status: "active" } });
  ok("agent actif");

  // 4. Catalogue
  step("Catalogue");
  const have = await call(`/api/agents/${agentId}/products`, { token });
  const names = new Set((have.products || []).map((p) => p.name));
  let added = 0;
  for (const p of PRODUCTS) {
    if (names.has(p.name)) continue;
    await call(`/api/agents/${agentId}/products`, { method: "POST", token, body: { ...p, currency: "XAF" } });
    added += 1;
  }
  ok(added ? `${added} produits ajoutés` : "déjà complet");

  // 5. Commandes — via l'API publique, comme le ferait le site d'un client.
  step("Commandes");
  // La valeur d'une clé n'est affichée qu'à sa création : au second passage on
  // ne peut pas la relire. On révoque donc l'ancienne clé de démo et on en
  // reprend une — sur un compte de démonstration, c'est sans conséquence, et
  // cela rend le script rejouable sans intervention manuelle.
  const keys = await call(`/api/agents/${agentId}/api-keys`, { token });
  for (const k of keys.keys || []) {
    if (k.kind === "secret" && !k.revoked_at && k.label === "Démo Play Store") {
      await call(`/api/agents/${agentId}/api-keys`, { method: "DELETE", token, body: { id: k.id } });
      ok("ancienne clé de démo révoquée");
    }
  }
  const k = await call(`/api/agents/${agentId}/api-keys`, {
    method: "POST",
    token,
    body: { kind: "secret", label: "Démo Play Store" },
  });
  const secret = k.key;

  // Les lignes sont décrites par nom ci-dessus, pour rester lisibles. On les
  // convertit ici en identifiants : sans id, Camille ne connaît pas le prix et
  // la commande ne totalise que les frais de livraison — un catalogue à 4 500 F
  // affiché à 1 000 F saute aux yeux d'un relecteur.
  const catalog = await call(`/api/agents/${agentId}/products`, { token });
  const idByName = new Map((catalog.products || []).map((p) => [p.name, p.id]));

  let n = 0;
  for (const o of ORDERS) {
    const items = o.items.map((it) => {
      const id = idByName.get(it.name);
      if (!id) throw new Error(`produit absent du catalogue : ${it.name}`);
      return { id, qty: it.qty };
    });
    try {
      await call("/api/public/v1/orders", { method: "POST", key: secret, body: { ...o, items } });
      n += 1;
    } catch (e) {
      console.log(`  ! commande ignorée : ${e.message}`);
    }
  }
  ok(`${n} commandes créées`);

  // ─── Récapitulatif à recopier dans la Play Console ───
  console.log(`
────────────────────────────────────────────────────────────
  À saisir dans Play Console → Contenu de l'app → Accès

  Nom d'utilisateur : ${EMAIL}
  Mot de passe      : ${PASSWORD}

  Instructions pour le relecteur :

    Se connecter avec les identifiants ci-dessus. Le compte
    contient un restaurant de démonstration, son catalogue et
    des commandes. La connexion d'un compte WhatsApp n'est PAS
    nécessaire pour parcourir l'application : toutes les
    fonctions consultables le sont depuis l'écran d'accueil.
────────────────────────────────────────────────────────────`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
