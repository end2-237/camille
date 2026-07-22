import React, { useEffect, useState, useCallback } from "react";
import { View, SafeAreaView, StatusBar, RefreshControl, ScrollView, Platform } from "react-native";
import { C } from "./src/theme";
import { Header, BottomNav } from "./src/components/ui";
import Dashboard from "./src/screens/Dashboard";
import Agents from "./src/screens/Agents";
import Conversations from "./src/screens/Conversations";
import Login from "./src/screens/Login";
import { loadToken, getStats, getAgents } from "./src/api";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [tab, setTab] = useState("dash");
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.allSettled([getStats("30d"), getAgents()]);
      const st = s.status === "fulfilled" ? s.value : {};
      // fusionne la liste d'agents (avec emoji/secteur) dans stats.agents
      if (a.status === "fulfilled" && Array.isArray(a.value?.agents || a.value)) {
        const list = a.value.agents || a.value;
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
      setStats(st);
    } catch (e) {
      // silencieux -> les écrans affichent la démo
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) { setAuthed(true); await load(); }
      else { setShowLogin(true); }
      setReady(true);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  if (showLogin && !authed) {
    return (
      <Login onDone={async () => { setShowLogin(false); setAuthed(true); await load(); }} />
    );
  }

  const Screen = { dash: Dashboard, agents: Agents, convos: Conversations }[tab] || Dashboard;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={{ paddingTop: Platform.OS === "android" ? 12 : 0 }}>
        <Header />
      </View>
      <View style={{ flex: 1 }}>
        <Screen stats={stats} refreshing={refreshing} onRefresh={onRefresh} />
      </View>
      <BottomNav tab={tab} setTab={setTab} />
    </SafeAreaView>
  );
}
