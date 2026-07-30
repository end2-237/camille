import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { View, Text, SafeAreaView, StatusBar, Platform, Animated, AppState } from "react-native";
import * as Updates from "expo-updates";
import { registerForPush, listenPush, clearBadge } from "./src/push";
import Notifications from "./src/screens/Notifications";
import ForceUpdate from "./src/screens/ForceUpdate";
import { getNotifications, checkAppVersion } from "./src/api";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "./src/theme";
import { Header, BottomNav, ScreenTitle } from "./src/components/ui";
import Splash from "./src/screens/Splash";
import Onboarding from "./src/screens/Onboarding";
import Login from "./src/screens/Login";
import Dashboard from "./src/screens/Dashboard";
import Agents from "./src/screens/Agents";
import Conversations from "./src/screens/Conversations";
import Analytics from "./src/screens/Analytics";
import Profile from "./src/screens/Profile";
import { loadToken, getStats, getAgents, getMe } from "./src/api";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [onboard, setOnboard] = useState(false);
  const [tab, setTab] = useState("dash");
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [unread, setUnread] = useState(0);
  const [gate, setGate] = useState(null); // mise a jour obligatoire

  const load = useCallback(async () => {
    const [s, a, m] = await Promise.allSettled([getStats("30d"), getAgents(), getMe()]);
    const st = s.status === "fulfilled" ? (s.value || {}) : {};
    if (a.status === "fulfilled") {
      const list = a.value?.agents || a.value;
      if (Array.isArray(list)) {
        const byId = {};
        (st.agents || []).forEach((x) => { byId[x.agent_id] = x; });
        st.agents = list.map((ag) => ({
          agent_id: ag.id,
          name: ag.identity?.name || ag.name,
          avatar_emoji: ag.identity?.avatar_emoji,
          sector: ag.business_context?.sector || ag.sector,
          business_name: ag.business_context?.business_name || ag.business_name,
          status: ag.status,
          messages: byId[ag.id]?.period_messages ?? byId[ag.id]?.messages ?? 0,
          ...byId[ag.id],
        }));
      }
    }
    setStats(st);
    if (m.status === "fulfilled") setUser(m.value?.user || null);

    // Compteur de la cloche. Silencieux : une erreur ici ne doit pas
    // empecher le reste du tableau de bord de s'afficher.
    getNotifications(1).then((d) => setUnread(Number(d?.unread || 0))).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      await loadToken();
      let seen = "1";
      try { seen = await AsyncStorage.getItem("camille_onboarded"); } catch {}
      setOnboard(!seen);
      try { await load(); } catch {}
      // petit délai pour laisser voir le splash
      setTimeout(() => setBooting(false), 900);
    })();
  }, [load]);

  // ── Mise a jour obligatoire ────────────────────────────────────────────────
  // Verifiee AVANT toute autre chose : si la version installee est trop
  // ancienne, l'app est inutilisable. Une panne reseau ne bloque jamais.
  useEffect(() => {
    const v = Constants.expoConfig?.version || "0.0.0";
    checkAppVersion(v, Platform.OS)
      .then((d) => { if (d?.blocking) setGate({ ...d, current: v }); })
      .catch(() => {});
  }, []);

  // ── Notifications push ─────────────────────────────────────────────────────
  // Enregistrement une fois connecté (le jeton est rattaché au compte), puis
  // écoute : bandeau si l'app est ouverte, rafraîchissement au tap.
  useEffect(() => {
    if (!user) return undefined;
    registerForPush();
    const stop = listenPush(
      () => { load().catch(() => {}); setUnread((n) => n + 1); },  // reçue app ouverte
      (data) => {                                     // l'utilisateur a tapé dessus
        clearBadge();
        load().catch(() => {});
        if (data?.type === "order") setTab("agents");
      }
    );
    return stop;
  }, [user, load]);

  // ── Mise à jour OTA automatique ────────────────────────────────────────────
  // Vérifie au lancement ET chaque fois que l'app revient au premier plan.
  // Si une mise à jour existe : téléchargement puis rechargement IMMÉDIAT du
  // bundle JS — l'utilisateur n'a rien à faire, et le téléphone ne redémarre pas.
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return undefined;

    let busy = false;
    async function check() {
      if (busy) return;
      busy = true;
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          setUpdating(true);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); // recharge l'app instantanément
        }
      } catch {
        // hors ligne ou serveur injoignable : on réessaiera au prochain passage
      } finally {
        busy = false;
        setUpdating(false);
      }
    }

    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, []);

  const finishOnboarding = useCallback(async () => {
    try { await AsyncStorage.setItem("camille_onboarded", "1"); } catch {}
    setOnboard(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } catch {}
    setRefreshing(false);
  }, [load]);

  const onAuthChange = useCallback(async () => {
    try { await load(); } catch {}
  }, [load]);

  const initials = useMemo(() => {
    if (!user) return "";
    const n = user.full_name || user.email || "";
    const parts = n.split(/[\s@.]+/).filter(Boolean);
    return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
  }, [user]);

  if (booting) return <Splash />;
  if (onboard) return <Onboarding onDone={finishOnboarding} />;
  if (!user) return <Login onDone={onAuthChange} />;

  const onAgentChanged = (agentId, patch) => {
    setStats((prev) => {
      if (!prev?.agents) return prev;
      return { ...prev, agents: prev.agents.map((a) => (a.agent_id === agentId ? { ...a, ...patch } : a)) };
    });
  };

  const common = { stats, query, refreshing, onRefresh };
  let Body;
  // Le blocage passe avant tout : ni onglets, ni en-tete, ni contenu.
  if (gate) return <ForceUpdate info={gate} />;

  if (tab === "dash") Body = <Dashboard {...common} user={user} />;
  else if (tab === "agents") Body = <Agents {...common} onAgentChanged={onAgentChanged} onRefreshData={load} />;
  else if (tab === "convos") Body = <Conversations {...common} />;
  else if (tab === "analytics") Body = <Analytics {...common} user={user} />;
  else if (tab === "notifs") Body = <Notifications onOpenOrders={() => setTab("agents")} />;
  else Body = <Profile user={user} setUser={setUser} onAuthChange={onAuthChange} agents={stats?.agents || []} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={{ paddingTop: Platform.OS === "android" ? 12 : 0 }}>
        <Header
          query={query}
          setQuery={setQuery}
          initials={initials}
          onProfile={() => setTab("profile")}
          onNotifications={() => { setTab("notifs"); setUnread(0); clearBadge(); }}
          unread={unread}
        />
        {tab === "dash" || tab === "agents" || tab === "analytics" ? <ScreenTitle tab={tab} /> : null}
      </View>
      {updating && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 999, backgroundColor: C.ink, paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ color: C.lime, fontSize: 11.5, fontWeight: "600" }}>Mise à jour en cours…</Text>
        </View>
      )}
      <AnimatedScreen tabKey={tab}>{Body}</AnimatedScreen>
      <BottomNav tab={tab} setTab={setTab} />
    </SafeAreaView>
  );
}

// Fondu + léger slide vertical à chaque changement d'onglet.
function AnimatedScreen({ tabKey, children }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [tabKey, a]);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View style={{ flex: 1, opacity: a, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
