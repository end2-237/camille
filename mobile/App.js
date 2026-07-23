import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, SafeAreaView, StatusBar, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "./src/theme";
import { Header, BottomNav, ScreenTitle } from "./src/components/ui";
import Splash from "./src/screens/Splash";
import Onboarding from "./src/screens/Onboarding";
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
          messages: byId[ag.id]?.messages ?? 0,
          ...byId[ag.id],
        }));
      }
    }
    setStats(st);
    if (m.status === "fulfilled") setUser(m.value?.user || null);
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

  const common = { stats, query, refreshing, onRefresh };
  let Body;
  if (tab === "dash") Body = <Dashboard {...common} />;
  else if (tab === "agents") Body = <Agents {...common} />;
  else if (tab === "convos") Body = <Conversations {...common} />;
  else if (tab === "analytics") Body = <Analytics {...common} />;
  else Body = <Profile user={user} setUser={setUser} onAuthChange={onAuthChange} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={{ paddingTop: Platform.OS === "android" ? 12 : 0 }}>
        <Header
          query={query}
          setQuery={setQuery}
          initials={initials}
          onProfile={() => setTab("profile")}
        />
        {tab === "dash" || tab === "agents" || tab === "analytics" ? <ScreenTitle tab={tab} /> : null}
      </View>
      <View style={{ flex: 1 }}>{Body}</View>
      <BottomNav tab={tab} setTab={setTab} />
    </SafeAreaView>
  );
}
