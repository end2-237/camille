import React, { useMemo } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { Card, StatMini, EmptyHint } from "../components/ui";

export default function Agents({ stats, query, refreshing, onRefresh }) {
  const all = stats?.agents || [];
  const ov = stats?.overview || {};
  const q = (query || "").trim().toLowerCase();
  const agents = useMemo(
    () => (q ? all.filter((a) => `${a.name || ""} ${a.business_name || ""} ${a.sector || ""}`.toLowerCase().includes(q)) : all),
    [all, q]
  );
  const active = all.filter((a) => (a.status || "active") === "active").length;
  const top = [...all].sort((a, b) => (b.messages || 0) - (a.messages || 0))[0];

  const respRate = ov.escalation_rate != null ? 100 - Math.round(ov.escalation_rate) : null;
  const conv = ov.lead_conversion != null ? Math.round(ov.lead_conversion) : null;
  const latency = ov.avg_response_ms != null ? (ov.avg_response_ms / 1000).toFixed(1) + "s" : "—";
  const convLen = ov.avg_conv_length != null ? Math.round(ov.avg_conv_length) + " msg" : "—";

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>

      <View style={{ backgroundColor: C.lime, borderRadius: R.lg, padding: S.md, marginBottom: S.md, overflow: "hidden" }}>
        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18, letterSpacing: -0.3 }}>Agents en ligne</Text>
        <Text style={{ color: "rgba(0,0,0,0.6)", fontSize: 12, marginTop: 4, width: "72%" }}>
          Vos vendeurs IA répondent à vos clients en temps réel sur WhatsApp
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14,
          backgroundColor: C.ink, alignSelf: "flex-start", paddingHorizontal: 14, height: 34, borderRadius: R.pill }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} />
          <Text style={{ color: C.white, fontWeight: "600", fontSize: 13 }}>{active} actif{active > 1 ? "s" : ""}</Text>
        </View>
        <Ionicons name="chatbubbles" size={90} color="rgba(0,0,0,0.08)" style={{ position: "absolute", right: -10, top: 10 }} />
      </View>

      {all.length > 0 && (
        <Card style={{ marginBottom: S.md }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Vue d'ensemble</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <StatMini dark label="Taux de réponse" value={respRate != null ? `${respRate}%` : "—"} />
            <StatMini dark label="Conversion lead" value={conv != null ? `${conv}%` : "—"} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatMini dark label="Latence moy." value={latency} />
            <StatMini dark label="Long. conv." value={convLen} />
          </View>

          {top && (
            <>
              <View style={{ height: 1, backgroundColor: C.lineDark, marginVertical: 14 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 42, height: 42, borderRadius: R.pill, backgroundColor: "#3A3A40", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 18 }}>{top.avatar_emoji || "🤖"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>{top.name}</Text>
                  <Text style={{ color: C.subDark, fontSize: 11 }}>Agent le plus actif</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.lime, paddingHorizontal: 10, height: 26, borderRadius: R.pill }}>
                  <Ionicons name="chatbubble" size={11} color={C.ink} />
                  <Text style={{ color: C.ink, fontWeight: "700", fontSize: 12 }}>{top.messages ?? 0}</Text>
                </View>
              </View>
            </>
          )}
        </Card>
      )}

      {all.length > 0 && (
        <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 8, marginLeft: 2 }}>
          {agents.length} agent{agents.length > 1 ? "s" : ""}{q ? ` · « ${query} »` : ""}
        </Text>
      )}

      {agents.map((a) => (
        <View key={a.agent_id} style={{ backgroundColor: C.white, borderRadius: R.lg, padding: S.md, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F1F1", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>{a.avatar_emoji || "🤖"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>{a.name}</Text>
              <Text style={{ color: C.sub, fontSize: 11 }}>{a.business_name || a.sector || "Agent"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15 }}>{a.messages ?? 0}</Text>
              <Text style={{ color: C.sub, fontSize: 10 }}>messages</Text>
            </View>
          </View>
        </View>
      ))}

      {!all.length && <EmptyHint text="Aucun agent pour le moment. Crée ton premier agent sur le dashboard web." />}
      {all.length > 0 && !agents.length && <EmptyHint text="Aucun agent ne correspond à ta recherche." />}
    </ScrollView>
  );
}
