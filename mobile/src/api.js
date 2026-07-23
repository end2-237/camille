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
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
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

export const patchAgent = (id, body) =>
  req(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export async function logout() {
  try { await req("/api/auth/logout", { method: "POST" }); } catch {}
  await setToken(null);
}

export function isLoggedIn() {
  return !!TOKEN;
}
