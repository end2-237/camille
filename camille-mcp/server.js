// server.js — Serveur MCP "Camille Catalogue" (JSON-RPC 2.0 sur stdio, sans dépendance).
// Expose le catalogue (Camille et/ou une marketplace) comme OUTILS MCP réutilisables
// par n'importe quel client compatible (Claude Desktop, IDE, etc.).
//
// Connecteurs (env SOURCE = "camille" | "marketplace") :
//   camille       → CAMILLE_API_URL (déf. https://camille.vps.buyticle.com) + AGENT_ID
//   marketplace   → MARKETPLACE_API_URL (REST) + mapping de champs configurable
//
// Outils exposés :
//   catalogue_search        { query, limit? }        → produits pertinents
//   catalogue_list          { }                       → tout le catalogue
//   catalogue_categories    { }                       → catégories + comptage
//   catalogue_search_image  { imageUrl, limit? }      → produits visuellement proches
//   catalogue_get           { id }                    → un produit précis

"use strict";

const SOURCE = (process.env.SOURCE || "camille").toLowerCase();
const CAMILLE_API = (process.env.CAMILLE_API_URL || "https://camille.vps.buyticle.com").replace(/\/+$/, "");
const AGENT_ID = process.env.AGENT_ID || "";
const MARKET_API = (process.env.MARKETPLACE_API_URL || "").replace(/\/+$/, "");
const MARKET_KEY = process.env.MARKETPLACE_API_KEY || "";
// mapping de champs marketplace -> modèle produit (JSON dans MARKETPLACE_FIELD_MAP)
let MAP = { id: "id", name: "name", price: "price", currency: "currency", category: "category", image_url: "image", product_url: "url", description: "description" };
try { if (process.env.MARKETPLACE_FIELD_MAP) MAP = Object.assign(MAP, JSON.parse(process.env.MARKETPLACE_FIELD_MAP)); } catch { /* défaut */ }

const SERVER_INFO = { name: "camille-catalogue", version: "1.0.0" };
const PROTOCOL = "2024-11-05";

// ── Connecteurs ──────────────────────────────────────────────────────────────
async function jget(url, headers) {
  const r = await fetch(url, { headers: headers || {} });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return r.json();
}
async function jpost(url, body, headers) {
  const r = await fetch(url, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers || {}), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`POST ${url} → ${r.status}`);
  return r.json();
}

function mapMarketProduct(p) {
  const g = (k) => p[MAP[k]];
  return { id: g("id"), name: g("name"), price: g("price"), currency: g("currency") || "XAF", category: g("category"), image_url: g("image_url"), product_url: g("product_url"), description: g("description") };
}

const connectors = {
  camille: {
    async search(query, limit) {
      const d = await jget(`${CAMILLE_API}/api/agents/${AGENT_ID}/products/search?q=${encodeURIComponent(query || "")}&limit=${limit || 12}`);
      return d.products || [];
    },
    async list() {
      const d = await jget(`${CAMILLE_API}/api/catalog/${AGENT_ID}`);
      return d.products || [];
    },
    async searchImage(imageUrl, limit) {
      const d = await jpost(`${CAMILLE_API}/api/agents/${AGENT_ID}/products/search-by-image`, { imageUrl, limit: limit || 6 });
      return d.products || [];
    },
    async get(id) {
      const all = await this.list();
      return all.find((p) => String(p.id) === String(id)) || null;
    },
  },
  marketplace: {
    async search(query, limit) {
      const d = await jget(`${MARKET_API}/products?q=${encodeURIComponent(query || "")}&limit=${limit || 12}`, MARKET_KEY ? { Authorization: `Bearer ${MARKET_KEY}` } : {});
      return (Array.isArray(d) ? d : d.products || d.data || []).map(mapMarketProduct);
    },
    async list() {
      const d = await jget(`${MARKET_API}/products`, MARKET_KEY ? { Authorization: `Bearer ${MARKET_KEY}` } : {});
      return (Array.isArray(d) ? d : d.products || d.data || []).map(mapMarketProduct);
    },
    async searchImage() { throw new Error("recherche par image non disponible pour la marketplace"); },
    async get(id) {
      const d = await jget(`${MARKET_API}/products/${encodeURIComponent(id)}`, MARKET_KEY ? { Authorization: `Bearer ${MARKET_KEY}` } : {});
      return mapMarketProduct(d.product || d.data || d);
    },
  },
};
const C = connectors[SOURCE] || connectors.camille;

function categoriesOf(products) {
  const m = {};
  products.forEach((p) => { const c = p.category || "Autre"; m[c] = (m[c] || 0) + 1; });
  return Object.keys(m).map((k) => ({ category: k, count: m[k] }));
}

// ── Définition des outils ────────────────────────────────────────────────────
const TOOLS = [
  { name: "catalogue_search", description: "Recherche des produits pertinents dans le catalogue par mots-clés.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "catalogue_list", description: "Renvoie tout le catalogue de produits.", inputSchema: { type: "object", properties: {} } },
  { name: "catalogue_categories", description: "Liste les catégories du catalogue avec le nombre de produits.", inputSchema: { type: "object", properties: {} } },
  { name: "catalogue_search_image", description: "Trouve les produits visuellement proches d'une image (URL).", inputSchema: { type: "object", properties: { imageUrl: { type: "string" }, limit: { type: "number" } }, required: ["imageUrl"] } },
  { name: "catalogue_get", description: "Renvoie un produit précis par son id.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
];

async function callTool(name, args) {
  args = args || {};
  if (name === "catalogue_search") return C.search(args.query, args.limit);
  if (name === "catalogue_list") return C.list();
  if (name === "catalogue_categories") return categoriesOf(await C.list());
  if (name === "catalogue_search_image") return C.searchImage(args.imageUrl, args.limit);
  if (name === "catalogue_get") return C.get(args.id);
  throw new Error("outil inconnu: " + name);
}

// ── Boucle JSON-RPC (stdio, messages délimités par des sauts de ligne) ────────
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
function reply(id, result) { send({ jsonrpc: "2.0", id, result }); }
function replyErr(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return reply(id, { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return; // notifications: pas de réponse
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: TOOLS });
  if (method === "tools/call") {
    try {
      const data = await callTool(params && params.name, params && params.arguments);
      return reply(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
    } catch (e) {
      return reply(id, { content: [{ type: "text", text: "Erreur: " + String(e.message || e) }], isError: true });
    }
  }
  if (id !== undefined) replyErr(id, -32601, "méthode non supportée: " + method);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    handle(msg).catch((e) => { if (msg && msg.id !== undefined) replyErr(msg.id, -32603, String(e.message || e)); });
  }
});
process.stderr.write(`camille-catalogue MCP prêt (source=${SOURCE})\n`);
