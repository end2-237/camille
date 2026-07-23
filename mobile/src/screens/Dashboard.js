import React from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { Card } from "../components/ui";
import { BarChart, Gauge } from "../components/charts";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function Dashboard({ stats, refreshing, onRefresh }) {
  const daily = stats?.daily_series || [];
  // Série mensuelle pour le bar chart (nb messages), repli sur demo si vide.
  let bars = (stats?.monthly_tokens || []).map((m, i) => ({ l: m.period, v: Math.round(m.total_tokens / 1000) }));
  if (!bars.length) bars = MONTHS.map((m, i) => ({ l: m, v: Math.round(40 + 55 * Math.abs(Math.sin(i * 1.3))) }));

  const ov = stats?.overview || {};
  const messages = ov.total_messages ?? 0;
  const leads = ov.total_leads ?? 0;
  const contacts = ov.unique_contacts ?? 0;
  const gaugeVal = messages || 716084;
  const gaugeMax = Math.max(gaugeVal * 1.25, 100);

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>
      {/* Fulfillment / Performance des agents */}
      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Performance des agents</Text>
          <Ionicons name="calendar-outline" size={16} color={C.subDark} />
        </View>
        <View style={{ marginTop: 14 }}>
          <BarChart data={bars} height={120} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          {bars.filter((_, i) => i % 2 === 0).slice(0, 6).map((b, i) => (
            <Text key={i} style={{ color: C.subDark, fontSize: 9 }}>{b.l}</Text>
          ))}
        </View>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12 }}>
          <Text style={{ color: C.lime, fontSize: 13, fontWeight: "600" }}>Voir plus</Text>
          <Ionicons name="arrow-forward" size={13} color={C.lime} />
        </TouchableOpacity>
      </Card>

      {/* Sales Overview -> Volume / CA */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Aperçu du volume</Text>
          <Ionicons name="options-outline" size={16} color={C.subDark} />
        </View>
        <View style={{ alignItems: "center", marginTop: 6 }}>
          <Gauge value={gaugeVal} max={gaugeMax} size={230} />
          <View style={{ position: "absolute", top: 44, alignItems: "center" }}>
            <Text style={{ color: C.white, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }}>
              {messages ? messages.toLocaleString("fr-FR") : "716 084"}
            </Text>
            <Text style={{ color: C.subDark, fontSize: 11, marginTop: 2 }}>messages traités</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Legend color={C.lime} label="Contacts" val={contacts || 128} />
          <Legend color="#7FB2FF" label="Leads" val={leads || 342} />
          <Legend color="#F0A6FF" label="Escalades" val={ov.total_escalations || 21} />
          <Legend color="#FFD166" label="Tokens" val={fmtK(ov.total_tokens || 512000)} />
        </View>
      </Card>
    </ScrollView>
  );
}

function Legend({ color, label, val }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ color: C.subDark, fontSize: 10 }}>{label}</Text>
      </View>
      <Text style={{ color: C.white, fontSize: 12, fontWeight: "700", marginTop: 3 }}>{val}</Text>
    </View>
  );
}

function fmtK(n) {
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n);
}
