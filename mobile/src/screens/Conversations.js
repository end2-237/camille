import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { EmptyHint } from "../components/ui";

const TABS = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "paused", label: "En pause" },
];

// Suivi RÉEL de l'activité par agent (messages, statut). Aucune donnée fictive.
export default function Conversations({ stats, query, refreshing, onRefresh }) {
  const [tab, setTab] = useState("all");
  const agents = stats?.agents || [];
  const ov = stats?.overview || {};
  const q = (query || "").trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = agents;
    if (tab === "active") list = list.filter((a) => (a.status || "active") === "active");
    if (tab === "paused") list = list.filter((a) => a.status === "paused");
    if (q) list = list.filter((a) => `${a.name || ""} ${a.sector || ""} ${a.business_name || ""}`.toLowerCase().includes(q));
    return [...list].sort((a, b) => (b.messages || 0) - (a.messages || 0));
  }, [agents, tab, q]);

  const counts = {
    all: agents.length,
    active: agents.filter((a) => (a.status || "active") === "active").length,
    paused: agents.filter((a) => a.status === "paused").length,
  };
  const totalMsg = Number(ov.total_messages || agents.reduce((s, a) => s + (a.messages || 0), 0));

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.4 }}>Conversations</Text>
        <View style={{ backgroundColor: C.ink, borderRadius: R.pill, paddingHorizontal: 9, height: 22, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.lime, fontSize: 11, fontWeight: "700" }}>{totalMsg}</Text>
        </View>
      </View>

      {agents.length > 0 && (
        <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: R.pill, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: C.line }}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 34, borderRadius: R.pill, backgroundColor: tab === t.key ? C.ink : "transparent" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: tab === t.key ? C.white : C.sub }}>{t.label}</Text>
              <View style={{ backgroundColor: tab === t.key ? C.lime : "#EEE", borderRadius: R.pill, paddingHorizontal: 6, minWidth: 18, height: 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: C.ink }}>{counts[t.key]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filtered.map((a) => (
        <View key={a.agent_id} style={{ backgroundColor: C.white, borderRadius: R.lg, padding: S.md, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "#F1F1F1", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20 }}>{a.avatar_emoji || "🤖"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>{a.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (a.status || "active") === "active" ? C.green : C.amber }} />
                <Text style={{ color: C.sub, fontSize: 11 }}>
                  {(a.status || "active") === "active" ? "Actif" : "En pause"} · {a.sector || a.business_name || "WhatsApp"}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Ionicons name="chatbubble-ellipses" size={18} color={C.ink} />
              <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15, marginTop: 2 }}>{a.messages ?? 0}</Text>
              <Text style={{ color: C.sub, fontSize: 9 }}>messages</Text>
            </View>
          </View>
        </View>
      ))}

      {!agents.length && <EmptyHint text="Aucune conversation pour le moment." />}
      {agents.length > 0 && !filtered.length && <EmptyHint text="Rien ne correspond à ce filtre." />}
    </ScrollView>
  );
}
