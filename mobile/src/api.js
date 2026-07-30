import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE =
  (Constants.expoConfig?.extra?.apiBaseUrl) ||
  "https://camille.vps.buyticle.com";

let TOKEN = null;

export async function loadToken() {
  if (TOKEN) return TOKEN;
  TOKEN = await AsyncStorage.getItem("camille_token");
  return TOKEN;
}

export async function setToken(t) {
  TOKEN = t;
  if (t) await AsyncStorage.setItem("camille_token", t);
  else await AsyncStorage.removeItem("camille_token");
}

async function req(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  // On remonte le detail du serveur : un "Erreur 500" nu ne dit rien a l'usage.
  if (!res.ok) {
    const msg = data.error || `Erreur ${res.status}`;
    throw new Error(data.detail ? `${msg} — ${data.detail}` : msg);
  }
  return data;
}

export async function login(email, password) {
  const data = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.token) await setToken(data.token);
  return data;
}

export const getStats = (period = "30d") =>
  req(`/api/stats?period=${encodeURIComponent(period)}`);

export const getAgents = () => req("/api/agents");

export const getMe = () => req("/api/auth/me");

export const getAgent = (id) => req(`/api/agents/${id}`);

// Création d'agent : l'API attend { formData, systemPrompt }
export const createAgent = (formData, compiledPrompt) =>
  req(`/api/agents`, {
    method: "POST",
    body: JSON.stringify({ formData, systemPrompt: { compiled_prompt: compiledPrompt } }),
  });

// Source du catalogue : 'camille' (natif) | 'ofs_cj' (grand catalogue OFS)
export const setCatalogSource = (agentId, source) =>
  req(`/api/agents/${agentId}/integrations/ofs-bind`, {
    method: "POST",
    body: JSON.stringify({ source }),
  });

export const patchAgent = (id, body) =>
  req(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export async function logout() {
  try { await req("/api/auth/logout", { method: "POST" }); } catch {}
  await setToken(null);
}

export function isLoggedIn() {
  return !!TOKEN;
}

// ── WhatsApp / Camille Core (WAHA) ──────────────────────────────────────────
export const wahaStatus = (agentId) => req(`/api/waha/status?agentId=${agentId}`);
export const wahaConnect = (agentId) => req(`/api/waha/connect`, { method: "POST", body: JSON.stringify({ agentId }) });
export const wahaDisconnect = (agentId) => req(`/api/waha/disconnect`, { method: "POST", body: JSON.stringify({ agentId }) });
export const wahaPairingCode = (agentId, phoneNumber) => req(`/api/waha/phone`, { method: "POST", body: JSON.stringify({ agentId, phoneNumber }) });
// Source (uri + headers) pour afficher le QR dans <Image>. `nonce` force le rafraîchissement.
export function wahaQrSource(sessionName, nonce = "") {
  return {
    uri: `${BASE}/api/waha/qr?session=${encodeURIComponent(sessionName)}${nonce ? `&n=${nonce}` : ""}`,
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  };
}

// ── Catalogue / produits ────────────────────────────────────────────────────
export const getProducts = (agentId) => req(`/api/agents/${agentId}/products`);

export const createProduct = (agentId, body) =>
  req(`/api/agents/${agentId}/products`, { method: "POST", body: JSON.stringify(body) });

export const updateProduct = (agentId, productId, body) =>
  req(`/api/agents/${agentId}/products/${productId}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteProduct = (agentId, productId) =>
  req(`/api/agents/${agentId}/products/${productId}`, { method: "DELETE" });

// ── Commandes ───────────────────────────────────────────────────────────────
export const getOrders = (agentId, status) =>
  req(`/api/orders${agentId || status ? "?" : ""}${agentId ? `agentId=${agentId}` : ""}${agentId && status ? "&" : ""}${status ? `status=${status}` : ""}`);

export const setOrderStatus = (orderId, status) =>
  req(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) });

// Trajet boutique -> client (distance, duree, trace)
export const getItinerary = (orderId) => req(`/api/orders/${orderId}/itinerary`);

// ── Upload d'image (carte du menu, photos produit) ──────────────────────────
// multipart : on ne passe PAS par req() qui force application/json.
export async function uploadImage(agentId, uri, name = "carte.jpg") {
  const fd = new FormData();
  const ext = (uri.split(".").pop() || "jpg").toLowerCase().replace("jpeg", "jpg");
  fd.append("file", { uri, name: `${name}`, type: `image/${ext === "png" ? "png" : "jpeg"}` });

  const res = await fetch(`${BASE}/api/agents/${agentId}/products/upload`, {
    method: "POST",
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    body: fd,
  });
  const text = await res.text();
  let d = {};
  try { d = text ? JSON.parse(text) : {}; } catch { d = { raw: text }; }
  if (!res.ok || !d.url) throw new Error(d.error || `Envoi impossible (${res.status})`);
  return d.url;
}

// ── Notifications push ──────────────────────────────────────────────────────
export const registerPushToken = (token, platform) =>
  req(`/api/push/register`, { method: "POST", body: JSON.stringify({ token, platform }) });

// ── Centre de notifications ─────────────────────────────────────────────────
export const getNotifications = (limit = 60) => req(`/api/notifications?limit=${limit}`);
export const markNotification = (id) => req(`/api/notifications`, { method: "PATCH", body: JSON.stringify({ id }) });
export const markAllNotifications = () => req(`/api/notifications`, { method: "PATCH", body: JSON.stringify({ all: true }) });

// ── Version minimale exigee (mise a jour obligatoire) ───────────────────────
// Pas d'authentification : la verification precede la connexion.
export const checkAppVersion = (version, platform = "android") =>
  req(`/api/app/version?platform=${platform}&version=${encodeURIComponent(version)}`);

// Diagnostic : quel maillon de la chaine push est casse
export const pushDiagnostic = () => req(`/api/push/diagnostic`);
export const pushTest = () => req(`/api/push/diagnostic`, { method: "POST" });

// ── Analyse des conversations (bloc entier) ─────────────────────────────────
export const getConversationAnalytics = (period = "30d", agentId) =>
  req(`/api/analytics/conversations?period=${period}${agentId ? `&agentId=${agentId}` : ""}`);

// ── Plans & paiements ───────────────────────────────────────────────────────
export const getPlans = () => req(`/api/plans`);
export const getPayments = () => req(`/api/payments/history`);
export const initiatePayment = (body) => req(`/api/payments/initiate`, { method: "POST", body: JSON.stringify(body) });
