import React from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { Card, StatMini } from "../components/ui";

// Ecran "Fleet performance" -> suivi des agents Camille par le client.
export default function Agents({ stats, refreshing, onRefresh }) {
  const agents = stats?.agents || [];
  const ov = stats?.overview || {};
  const active = agents.filter((a) => (a.status || "active") === "active").length || agents.length;

  const top = agents[0];

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 130 }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>
      {/* Bandeau vert "Vehicle on the road" -> Agent en ligne */}
      <View style={{ backgroundColor: C.lime, borderRadius: R.lg, padding: S.md, marginBottom: S.md, overflow: "hidden" }}>
        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18, letterSpacing: -0.3 }}>Agents en ligne</Text>
        <Text style={{ color: "rgba(0,0,0,0.6)", fontSize: 12, marginTop: 4, width: "70%" }}>
          Vos vendeurs IA répondent à vos clients en temps réel sur WhatsApp
        </Text>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14,
          backgroundColor: C.ink, alignSelf: "flex-start", paddingHorizontal: 14, height: 38, borderRadius: R.pill }}>
          <Text style={{ color: C.white, fontWeight: "600", fontSize: 13 }}>Suivre l'activité</Text>
          <Ionicons name="pulse" size={14} color={C.lime} />
        </TouchableOpacity>
        <Ionicons name="chatbubbles" size={90} color="rgba(0,0,0,0.08)"
          style={{ position: "absolute", right: -10, top: 10 }} />
      </View>

      {/* Fleet performance overview -> stats agrégées */}
      <Card style={{ marginBottom: S.md }}>
        <Text style={{ color: C.white, fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Vue d'ensemble des agents</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <StatMini dark label="Taux de réponse" value={`${100 - Math.round(ov.escalation_rate || 8)}%`} />
          <StatMini dark label="Conversion lead" value={`${Math.round(ov.lead_conversion || 34)}%`} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatMini dark label="Latence moy." value={`${((ov.avg_response_ms || 1200) / 1000).toFixed(1)}s`} />
          <StatMini dark label="Long. conv." value={`${(ov.avg_conv_length || 6).toFixed?.(0) ?? ov.avg_conv_length} msg`} />
        </View>

        <View style={{ height: 1, backgroundColor: C.lineDark, marginVertical: 14 }} />

        {/* Top agent -> "Lukas Weber Top-driver" */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 42, height: 42, borderRadius: R.pill, backgroundColor: "#3A3A40", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 18 }}>{top?.avatar_emoji || "🤖"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>{top?.name || "Agent Camille"}</Text>
            <Text style={{ color: C.subDark, fontSize: 11 }}>Agent le plus actif</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.lime, paddingHorizontal: 10, height: 26, borderRadius: R.pill }}>
            <Ionicons name="star" size={12} color={C.ink} />
            <Text style={{ color: C.ink, fontWeight: "700", fontSize: 12 }}>{top?.messages ? `${top.messages}` : "4.9"}</Text>
          </View>
        </View>

        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <Text style={{ color: C.subDark, fontSize: 13 }}>{active} agents actifs</Text>
          <Ionicons name="chevron-forward" size={16} color={C.subDark} />
        </TouchableOpacity>
      </Card>

      {/* Liste des agents */}
      {agents.map((a, i) => (
        <Card key={a.agent_id || i} dark={false} style={{ marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
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
        </Card>
      ))}
      {!agents.length && (
        <Text style={{ color: C.sub, textAlign: "center", marginTop: 20, fontSize: 13 }}>
          Connecte-toi pour voir tes agents.
        </Text>
      )}
    </ScrollView>
  );
}
