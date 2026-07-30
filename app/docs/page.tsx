// ─────────────────────────────────────────────────────────────────────────────
// app/docs — Documentation de l'API publique Camille.
//
// Page publique : un développeur qui intègre le site d'un marchand doit pouvoir
// la lire sans compte. Elle embarque un testeur en direct — lire une doc sans
// pouvoir l'essayer laisse toujours un doute.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";

const T = {
  ink: "var(--text-primary)",
  soft: "var(--text-secondary)",
  faint: "var(--text-tertiary)",
  line: "var(--border-subtle)",
  strong: "var(--border-strong)",
  card: "var(--bg-elevated)",
  sub: "var(--bg-subtle)",
  gold: "var(--color-gold)",
};

export default function DocsPage() {
  const base = typeof window !== "undefined" ? window.location.origin : "https://camille.vps.buyticle.com";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 90px" }}>
      <header style={{ marginBottom: 38 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: T.gold }}>API CAMILLE · v1</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: T.ink, letterSpacing: -0.8, marginTop: 8 }}>
          Brancher un site sur Camille
        </h1>
        <p style={{ fontSize: 15.5, color: T.soft, marginTop: 12, lineHeight: 1.6, maxWidth: 640 }}>
          Le site d&apos;un marchand appelle Camille comme n&apos;importe quelle API : il
          s&apos;annonce avec une clé, Camille en déduit l&apos;agent. Le catalogue reste
          saisi une seule fois, et les commandes du site arrivent au même endroit que
          celles de WhatsApp — avec le même accusé de réception au client.
        </p>
      </header>

      <Callout>
        <strong style={{ color: T.ink }}>Ce que ça change concrètement.</strong> Sans intégration,
        un marchand tient deux catalogues et deux paniers qui s&apos;ignorent. Avec, son site
        affiche le catalogue Camille, et un panier validé sur le site déclenche exactement
        la même chose qu&apos;une commande WhatsApp : accusé au client, alerte au commerçant,
        commande dans l&apos;app, bon de commande PDF au passage en traitement.
      </Callout>

      {/* ── Démarrage ── */}
      <Section n="1" title="Obtenir une clé">
        <p style={p}>
          Dans le dashboard Camille : ouvre un agent → <B>Intégrations</B> → section
          <B> API — brancher le site du client</B>. Deux natures de clé :
        </p>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", marginTop: 16 }}>
          <KeyCard
            tag="cam_pk_…" label="Clé de lecture" tone="#0e9d63"
            what="Lit le catalogue."
            where="Utilisable dans le navigateur — elle peut apparaître dans le code de la page."
          />
          <KeyCard
            tag="cam_sk_…" label="Clé secrète" tone="#101012"
            what="Crée des commandes."
            where="Serveur uniquement. Jamais dans du code envoyé au navigateur."
          />
        </div>

        <p style={{ ...p, marginTop: 16 }}>
          La clé n&apos;est affichée <B>qu&apos;une fois</B>, à la création : Camille n&apos;en
          conserve que l&apos;empreinte. Si tu la perds, révoque-la et génère-en une autre.
        </p>
        <p style={p}>
          Déclare aussi les <B>domaines autorisés</B> (ex. <Code>https://boutique-client.com</Code>).
          Les appels navigateur venant d&apos;ailleurs seront refusés.
        </p>
      </Section>

      {/* ── Authentification ── */}
      <Section n="2" title="S'authentifier">
        <p style={p}>Chaque requête porte la clé dans un en-tête :</p>
        <Pre>{`X-Camille-Key: cam_pk_xxxxxxxxxxxxxxxx`}</Pre>
        <p style={p}>
          <Code>Authorization: Bearer cam_pk_…</Code> fonctionne aussi, si ton client HTTP
          le gère mieux.
        </p>
      </Section>

      {/* ── Catalogue ── */}
      <Section n="3" title="Lire le catalogue">
        <Endpoint method="GET" path="/api/public/v1/catalog" keyKind="cam_pk_ ou cam_sk_" />

        <Table
          head={["Paramètre", "Défaut", "Rôle"]}
          rows={[
            ["q", "—", "Recherche dans le nom et la description"],
            ["category", "—", "Filtre sur une catégorie exacte"],
            ["limit", "24", "Entre 1 et 100"],
            ["offset", "0", "Pagination"],
          ]}
        />

        <Pre>{`curl "${base}/api/public/v1/catalog?limit=24" \\
  -H "X-Camille-Key: cam_pk_xxxxx"`}</Pre>

        <p style={{ ...p, marginTop: 18 }}>Réponse :</p>
        <Pre>{`{
  "products": [
    {
      "id": "3f2a…",
      "name": "Burger",
      "description": "Pain brioché, steak 150g",
      "price": 1000,
      "price_max": null,
      "currency": "XAF",
      "stock": 10,
      "category": "Plats",
      "subcategory": "Burgers",
      "image_url": "https://…/burger.jpg",
      "images": [],
      "variants": [{ "name": "Taille", "options": [{ "value": "Maxi" }] }],
      "product_url": "",
      "tags": []
    }
  ],
  "merchant": {
    "name": "YoosFood",
    "whatsapp": "237691175480",
    "location": "Douala, Bonamoussadi",
    "website": "https://yoosfood.com",
    "sector": "restauration"
  },
  "total": 42,
  "limit": 24,
  "offset": 0
}`}</Pre>

        <Callout>
          <strong style={{ color: T.ink }}>Sers-toi de <Code>merchant</Code> plutôt que de recopier.</strong>{" "}
          Le numéro WhatsApp, le nom commercial et la ville viennent de l&apos;agent. Un site
          qui les code en dur affiche de fausses coordonnées le jour où le marchand en
          change — et personne ne s&apos;en aperçoit avant qu&apos;un client se plaigne.
        </Callout>
      </Section>

      {/* ── Commandes ── */}
      <Section n="4" title="Envoyer une commande">
        <Endpoint method="POST" path="/api/public/v1/orders" keyKind="cam_sk_ uniquement" secret />

        <p style={p}>
          Deux façons de décrire une ligne. Avec un <Code>id</Code> produit, Camille
          <B> relit le prix en base</B> et ignore celui que tu envoies — un prix venu du
          navigateur n&apos;est jamais digne de confiance. Sans <Code>id</Code>, fournis
          <Code>name</Code> et <Code>price</Code> (utile pour un article hors catalogue).
        </p>

        <Pre>{`curl -X POST "${base}/api/public/v1/orders" \\
  -H "Content-Type: application/json" \\
  -H "X-Camille-Key: cam_sk_xxxxx" \\
  -d '{
    "items": [
      { "id": "3f2a…", "qty": 2 },
      { "name": "Sauce maison", "qty": 1, "price": 200 }
    ],
    "customer": { "name": "Eman Soga", "phone": "237699887766" },
    "delivery": { "address": "Bonaberi, face marché", "lat": 4.0511, "lng": 9.7679 },
    "note": "Sans oignon"
  }'`}</Pre>

        <Table
          head={["Champ", "Requis", "Rôle"]}
          rows={[
            ["items[]", "oui", "id + qty, ou name + price + qty"],
            ["customer.phone", "oui", "Chiffres seuls, INDICATIF PAYS COMPRIS : 237699887766"],
            ["customer.name", "non", "Apparaît sur le bon de commande"],
            ["delivery.address", "non", "Sert aussi à trouver le tarif du quartier"],
            ["delivery.lat / lng", "non", "Position exacte — active l'itinéraire vendeur"],
            ["delivery_fee", "non", "Force les frais. Omis, le barème de l'agent s'applique"],
            ["note", "non", "Remarque libre (sur place, à emporter…)"],
          ]}
        />

        <p style={{ ...p, marginTop: 18 }}>Réponse :</p>
        <Pre>{`{
  "ok": true,
  "order": {
    "id": "9c1e…",
    "ref": "AA7EVM",
    "subtotal": 2200,
    "delivery_fee": 1000,
    "total": 3200,
    "currency": "XAF",
    "status": "nouvelle"
  },
  "whatsapp_notified": true
}`}</Pre>

        <Callout tone="warn">
          <strong style={{ color: T.ink }}>Deux refus fréquents, et ce qu&apos;ils veulent dire.</strong>{" "}
          <Code>customer.phone</Code> sans indicatif pays crée une commande dont la
          confirmation n&apos;arrivera jamais : envoie <Code>237699887766</Code>, pas
          <Code>699887766</Code>. Et un <Code>id</Code> produit n&apos;est valable que dans le
          catalogue de <B>sa</B> clé : si tu changes de clé, les identifiants de l&apos;ancien
          agent renvoient <Code>Produit introuvable dans ce catalogue</Code>. Pense aux
          paniers déjà enregistrés chez tes visiteurs.
        </Callout>

        <Callout tone="ok">
          <strong style={{ color: T.ink }}>Ce qui se passe ensuite, sans rien coder de plus.</strong>{" "}
          Le client reçoit son accusé sur WhatsApp. Le commerçant reçoit une alerte et une
          notification sur son téléphone. La commande apparaît dans l&apos;app avec le badge
          « site web ». Au passage en traitement, le bon de commande PDF part au client.
        </Callout>
      </Section>

      {/* ── Testeur ── */}
      <Section n="5" title="Tester maintenant">
        <p style={p}>
          Colle une clé de lecture et appelle ton vrai catalogue. Rien n&apos;est enregistré
          par cette page — la requête part directement de ton navigateur vers l&apos;API.
        </p>
        <Tester base={base} />
      </Section>

      {/* ── Erreurs ── */}
      <Section n="6" title="Erreurs">
        <Table
          head={["Code", "Signification", "Que faire"]}
          rows={[
            ["401 « Clé manquante »", "En-tête absent", "Ajoute X-Camille-Key"],
            ["401 « Clé inconnue »", "Aucune clé ne correspond", "Recopie-la entièrement, sans espace ni retour à la ligne"],
            ["401 « Clé révoquée »", "La clé a été désactivée", "Génère-en une nouvelle dans Intégrations"],
            ["403 « Agent inactif »", "L'agent est en pause ou archivé", "Réactive l'agent — la clé, elle, est bonne"],
            ["403 (clé)", "Clé publique utilisée pour créer une commande", "Utilise la clé cam_sk_ côté serveur"],
            ["403 (domaine)", "Origine non déclarée", "Ajoute le domaine dans Intégrations"],
            ["400", "Requête incomplète", "Le message dit précisément quel champ manque"],
            ["503", "Intégration non configurée", "La migration migration_api_keys.sql n'est pas passée"],
          ]}
        />
      </Section>

      {/* ── Exemple complet ── */}
      <Section n="7" title="Exemple complet">
        <p style={p}>
          Une page qui affiche le catalogue et envoie le panier. Le front lit avec la clé
          publique ; l&apos;envoi passe par <B>ton</B> serveur, qui seul détient la clé secrète.
        </p>

        <Label>Front — affichage du catalogue</Label>
        <Pre>{`<div id="catalogue"></div>
<script>
const CAMILLE = "${base}";
const PK = "cam_pk_xxxxx";           // clé de lecture : peut rester ici
const panier = [];

fetch(CAMILLE + "/api/public/v1/catalog?limit=24", {
  headers: { "X-Camille-Key": PK },
})
  .then((r) => r.json())
  .then(({ products }) => {
    document.getElementById("catalogue").innerHTML = products
      .map((p) => \`
        <article>
          <img src="\${p.image_url}" alt="">
          <h3>\${p.name}</h3>
          <p>\${p.price.toLocaleString("fr-FR")} \${p.currency}</p>
          <button onclick="ajouter('\${p.id}')">Ajouter</button>
        </article>\`)
      .join("");
  });

function ajouter(id) {
  const ligne = panier.find((l) => l.id === id);
  if (ligne) ligne.qty++; else panier.push({ id, qty: 1 });
}

async function commander(nom, tel, adresse) {
  // On passe par NOTRE serveur : la clé secrète ne doit jamais arriver ici.
  const r = await fetch("/api/commander", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: panier, customer: { name: nom, phone: tel },
                           delivery: { address: adresse } }),
  });
  const d = await r.json();
  alert("Commande " + d.order.ref + " enregistrée. Tu reçois la confirmation sur WhatsApp.");
}
</script>`}</Pre>

        <Label>Serveur — relais vers Camille</Label>
        <Pre>{`// Node / Express — la clé secrète vit ICI, jamais dans le navigateur.
app.post("/api/commander", async (req, res) => {
  const r = await fetch("${base}/api/public/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Camille-Key": process.env.CAMILLE_SECRET_KEY,
    },
    body: JSON.stringify(req.body),
  });
  res.status(r.status).json(await r.json());
});`}</Pre>
      </Section>

      {/* ── Changer d'agent / faire tourner les clés ── */}
      <Section n="8" title="Changer d'agent, remplacer une clé">
        <p style={p}>
          C&apos;est la clé qui désigne l&apos;agent — jamais une configuration du site.
          Pour qu&apos;un site serve un autre compte, il suffit donc de changer la valeur de
          <Code>CAMILLE_SECRET_KEY</Code> chez ton hébergeur. Catalogue, commandes, numéro
          WhatsApp, nom commercial : tout suit la nouvelle clé sans toucher au code.
        </p>

        <Table
          head={["Étape", "Où", "Pourquoi"]}
          rows={[
            ["Générer la clé du nouvel agent", "Dashboard → Intégrations", "Elle n'est affichée qu'une fois"],
            ["Remplacer CAMILLE_SECRET_KEY", "Variables d'environnement", "Et la clé publique si tu en utilises une"],
            ["Redéployer", "Ton hébergeur", "Une variable changée ne prend effet qu'au déploiement suivant"],
            ["Révoquer l'ancienne clé", "Dashboard → Intégrations", "Tant qu'elle vit, elle commande encore"],
          ]}
        />

        <Callout tone="warn">
          <strong style={{ color: T.ink }}>Les paniers en cours pointent vers l&apos;ancien catalogue.</strong>{" "}
          Un visiteur qui avait rempli son panier avant la bascule garde des identifiants
          produit du compte précédent : sa commande sera refusée avec
          <Code>Produit introuvable dans ce catalogue</Code>. Prévois de purger les lignes
          dont l&apos;<Code>id</Code> a disparu du catalogue au chargement de la page — c&apos;est
          quelques lignes, et ça évite un client bloqué sans comprendre.
        </Callout>

        <p style={{ ...p, marginTop: 18 }}>
          Même procédure pour une clé compromise : générer, remplacer, redéployer, révoquer.
          Dans cet ordre — révoquer d&apos;abord couperait le site entre les deux.
        </p>
      </Section>

      <footer style={{ marginTop: 46, paddingTop: 22, borderTop: `1px solid ${T.line}`, fontSize: 13, color: T.faint }}>
        Une question sur l&apos;intégration ? Les clés se gèrent depuis le dashboard,
        onglet Intégrations de chaque agent.
      </footer>
    </div>
  );
}

/* ── Testeur en direct ─────────────────────────────────────────────────────── */

function Tester({ base }: { base: string }) {
  const [key, setKey] = useState("");
  const [limit, setLimit] = useState("5");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  async function run() {
    if (!key.trim()) { setOut("Colle d'abord une clé."); setOk(false); return; }
    setBusy(true); setOut(""); setOk(null);
    try {
      const r = await fetch(`${base}/api/public/v1/catalog?limit=${encodeURIComponent(limit)}`, {
        headers: { "X-Camille-Key": key.trim() },
      });
      const d = await r.json();
      setOk(r.ok);
      setOut(`HTTP ${r.status}\n\n${JSON.stringify(d, null, 2)}`);
    } catch (e) {
      setOk(false);
      setOut(`Échec réseau : ${(e as Error).message}`);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, background: T.card, marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="cam_pk_…" spellCheck={false}
          style={{ flex: "1 1 260px", minWidth: 0, padding: "10px 12px", borderRadius: 10,
            border: `1px solid ${T.strong}`, background: T.sub, color: T.ink,
            fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}
        />
        <input
          value={limit} onChange={(e) => setLimit(e.target.value)} type="number" min={1} max={100}
          style={{ width: 84, padding: "10px 12px", borderRadius: 10,
            border: `1px solid ${T.strong}`, background: T.sub, color: T.ink, fontSize: 13 }}
        />
        <button onClick={run} disabled={busy}
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
            background: T.gold, color: "#101012", fontWeight: 700, fontSize: 13.5, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Appel…" : "Appeler l'API"}
        </button>
      </div>

      {out && (
        <pre style={{ marginTop: 14, padding: 14, borderRadius: 10, maxHeight: 340, overflow: "auto",
          background: T.sub, color: T.soft, fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
          border: `1px solid ${ok === false ? "#c0392b55" : T.line}` }}>
          {out}
        </pre>
      )}
    </div>
  );
}

/* ── Éléments de mise en page ──────────────────────────────────────────────── */

const p: React.CSSProperties = { fontSize: 14.5, color: T.soft, lineHeight: 1.65, marginTop: 12 };

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 44 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ width: 27, height: 27, borderRadius: 8, background: T.sub, color: T.gold,
          display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800,
          border: `1px solid ${T.line}` }}>{n}</span>
        <h2 style={{ fontSize: 21, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Endpoint({ method, path, keyKind, secret }: { method: string; path: string; keyKind: string; secret?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14, marginBottom: 6 }}>
      <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 800,
        background: method === "GET" ? "#0e9d63" : "#101012", color: "#fff" }}>{method}</span>
      <code style={{ fontSize: 14, color: T.ink, fontFamily: "var(--font-mono, monospace)" }}>{path}</code>
      <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: secret ? "#FDECEC" : "#E4F8EC", color: secret ? "#c0392b" : "#0e6b45" }}>
        {keyKind}
      </span>
    </div>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{ marginTop: 12, padding: 15, borderRadius: 11, overflow: "auto",
      background: T.sub, border: `1px solid ${T.line}`, color: T.soft,
      fontSize: 12.2, lineHeight: 1.6, whiteSpace: "pre" }}>
      {children}
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={{ marginTop: 16, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 460 }}>
        <thead>
          <tr>{head.map((h) => (
            <th key={h} style={{ textAlign: "left", padding: "9px 12px", color: T.faint,
              fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase",
              borderBottom: `1px solid ${T.strong}` }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: "9px 12px", borderBottom: `1px solid ${T.line}`,
                  color: j === 0 ? T.ink : T.soft,
                  fontFamily: j === 0 ? "var(--font-mono, monospace)" : undefined,
                  fontSize: j === 0 ? 12.5 : 13.5, whiteSpace: j === 0 ? "nowrap" : undefined }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" }) {
  const accent = tone === "ok" ? "#0e9d63" : tone === "warn" ? "#c2410c" : T.gold;
  return (
    <div style={{ marginTop: 22, padding: 16, borderRadius: 12, fontSize: 14, lineHeight: 1.6,
      color: T.soft, background: T.sub,
      borderLeft: `3px solid ${accent}` }}>
      {children}
    </div>
  );
}

function KeyCard({ tag, label, what, where, tone }: { tag: string; label: string; what: string; where: string; tone: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${T.line}`, background: T.card }}>
      <code style={{ fontSize: 12.5, fontWeight: 700, color: tone === "#101012" ? T.ink : tone,
        fontFamily: "var(--font-mono, monospace)" }}>{tag}</code>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginTop: 5 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.soft, marginTop: 4 }}>{what}</div>
      <div style={{ fontSize: 12, color: T.faint, marginTop: 6, lineHeight: 1.5 }}>{where}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4,
      textTransform: "uppercase", color: T.faint }}>{children}</div>
  );
}

const B = ({ children }: { children: React.ReactNode }) => (
  <strong style={{ color: T.ink, fontWeight: 600 }}>{children}</strong>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <code style={{ padding: "2px 6px", borderRadius: 5, background: T.sub, color: T.ink,
    fontSize: 12.5, fontFamily: "var(--font-mono, monospace)" }}>{children}</code>
);
