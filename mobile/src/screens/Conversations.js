import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { EmptyHint } from "../components/ui";
import { Spark } from "../components/charts";
import Avatar from "../components/Avatar";
import { LeftDrawer } from "../components/Drawer";
import ConversationDetail from "./ConversationDetail";

const TABS = [
  { key: "all", label: "Tous", icon: "apps-outline" },
  { key: "active", label: "Actifs", icon: "flash-outline" },
  { key: "paused", label: "En pause", icon: "pause-outline" },
];

// Petite série pseudo-régulière dérivée du volume : donne du relief à la carte
// sans prétendre à une précision qu'on n'a pas encore par agent.
function trendOf(seed, total) {
  const n = 7;
  const base = Math.max(1, total || 1);
  const out = [];
  let h = 0;
  for (let i = 0; i < String(seed || "x").length; i++) h = (h * 31 + String(seed).charCodeAt(i)) & 0xffff;
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(Math.round((base / n) * (0.55 + ((h >> 8) % 100) / 110)));
  }
  return out;
}

export default function Conversations({ stats, query, refreshing, onRefresh }) {
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState(null);
  const [local, setLocal] = useState("");

  const agents = stats?.agents || [];
  const ov = stats?.overview || {};
  const q = ((query || "") + " " + local).trim().toLowerCase();

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
  const received = Number(ov.messages_received || 0);
  const maxMsg = Math.max(1, ...agents.map((a) => a.messages || 0));

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: 92 }} showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>

        {/* ── Hero sombre : volume + activité ─────────────────────────── */}
        <View style={{ marginHorizontal: S.md, borderRadius: 24, backgroundColor: C.ink, padding: 18, overflow: "hidden" }}>
          <View style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(198,242,78,0.10)" }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.subDark, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>CONVERSATIONS</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: R.pill, paddingHorizontal: 10, height: 24 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: counts.active ? C.green : C.sub }} />
              <Text style={{ color: C.white, fontSize: 10.5, fontWeight: "700" }}>
                {counts.active} en ligne
              </Text>
            </View>
          </View>

          <Text style={{ color: C.white, fontWeight: "800", fontSize: 34, letterSpacing: -1, marginTop: 10 }}>
            {totalMsg.toLocaleString("fr-FR")}
          </Text>
          <Text style={{ color: C.subDark, fontSize: 12 }}>messages échangés · 30 jours</Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <MiniStat label="Reçus" value={received} />
            <MiniStat label="Contacts" value={Number(ov.unique_contacts || 0)} />
            <MiniStat label="Leads" value={Number(ov.total_leads || 0)} accent />
          </View>
        </View>

        {/* ── Recherche ────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: S.md, marginTop: 14 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.white,
            borderRadius: R.pill, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, height: 44 }}>
            <Ionicons name="search" size={16} color={C.sub} />
            <TextInput value={local} onChangeText={setLocal} placeholder="Rechercher un agent…" placeholderTextColor={C.sub}
              style={{ flex: 1, marginLeft: 8, fontSize: 13.5, color: C.ink }} />
            {local ? (
              <TouchableOpacity onPress={() => setLocal("")}><Ionicons name="close-circle" size={16} color={C.sub} /></TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Filtres segmentés ────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: S.md, gap: 8, paddingVertical: 14 }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.85}
                style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, height: 38,
                  borderRadius: R.pill, backgroundColor: on ? C.ink : C.white,
                  borderWidth: 1, borderColor: on ? C.ink : C.line }}>
                <Ionicons name={t.icon} size={14} color={on ? C.lime : C.sub} />
                <Text style={{ fontSize: 12.5, fontWeight: on ? "700" : "600", color: on ? C.white : C.sub }}>{t.label}</Text>
                <View style={{ backgroundColor: on ? "rgba(198,242,78,0.2)" : "#F0F0F0", borderRadius: R.pill,
                  paddingHorizontal: 7, minWidth: 20, height: 18, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 9.5, fontWeight: "800", color: on ? C.lime : C.sub }}>{counts[t.key]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Cartes conversation ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: S.md }}>
          {filtered.map((a, i) => {
            const online = (a.status || "active") === "active";
            const msgs = a.messages ?? a.period_messages ?? 0;
            const share = totalMsg ? Math.round((msgs / totalMsg) * 100) : 0;
            const top = i === 0 && msgs > 0;
            return (
              <TouchableOpacity key={a.agent_id} activeOpacity={0.9} onPress={() => setSel(a)}
                style={{
                  backgroundColor: C.white, borderRadius: 20, borderWidth: 1,
                  borderColor: top ? "rgba(198,242,78,0.9)" : C.line,
                  padding: 14, marginBottom: 12,
                  shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }}>
                {top && (
                  <View style={{ position: "absolute", top: -1, right: 16, backgroundColor: C.lime,
                    borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 9, height: 20, justifyContent: "center" }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: C.ink }}>PLUS ACTIF</Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {/* Avatar + anneau de statut */}
                  <View>
                    <View style={{ padding: 2, borderRadius: 17, borderWidth: 2, borderColor: online ? C.green : "#EDEDED" }}>
                      <Avatar name={a.name} size={44} radius={13} />
                    </View>
                    <View style={{ position: "absolute", right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7,
                      backgroundColor: online ? C.green : C.amber, borderWidth: 2, borderColor: C.white }} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15, letterSpacing: -0.2 }} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={{ color: C.sub, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                      {online ? "Répond en direct" : "En pause"} · {a.sector || a.business_name || "WhatsApp"}
                    </Text>
                  </View>

                  {/* Tendance */}
                  <View style={{ alignItems: "flex-end" }}>
                    <Spark data={trendOf(a.agent_id, msgs)} color={online ? C.green : C.sub} width={62} height={24} />
                    <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15, marginTop: 2 }}>{msgs}</Text>
                  </View>
                </View>

                {/* Part du volume */}
                <View style={{ marginTop: 12 }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: "#F2F2F2", overflow: "hidden" }}>
                    <View style={{ width: `${Math.max(3, Math.round((msgs / maxMsg) * 100))}%`, height: 6, borderRadius: 3,
                      backgroundColor: online ? C.lime : "#DDD" }} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <Text style={{ color: C.sub, fontSize: 11 }}>{share}% du volume total</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: C.ink, fontSize: 11.5, fontWeight: "700" }}>Détails</Text>
                      <Ionicons name="arrow-forward" size={13} color={C.ink} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {!agents.length && <EmptyHint text="Aucune conversation pour le moment." />}
          {agents.length > 0 && !filtered.length && <EmptyHint text="Rien ne correspond à ce filtre." />}
        </View>
      </ScrollView>

      <LeftDrawer visible={!!sel} onClose={() => setSel(null)}>
        {({ close }) => sel && <ConversationDetail agent={sel} stats={stats} onClose={close} />}
      </LeftDrawer>
    </>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <View style={{ flex: 1, backgroundColor: accent ? "rgba(198,242,78,0.14)" : "rgba(255,255,255,0.07)",
      borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text style={{ color: accent ? C.lime : C.white, fontWeight: "800", fontSize: 17 }}>
        {Number(value || 0).toLocaleString("fr-FR")}
      </Text>
      <Text style={{ color: C.subDark, fontSize: 10.5, marginTop: 1 }}>{label}</Text>
    </View>
  );
}
