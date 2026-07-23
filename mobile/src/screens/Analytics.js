import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { Card, StatMini, EmptyHint } from "../components/ui";
import { BarChart } from "../components/charts";

function num(x) { return typeof x === "number" ? x : Number(x) || 0; }

export default function Analytics({ stats, refreshing, onRefresh }) {
  const ov = stats?.overview || {};

  const daily = (stats?.daily_series || []).map((d) => ({
    l: String(d.date || d.day || "").slice(5),
    v: num(d.messages ?? d.count ?? d.total ?? d.total_messages),
  }));
  const hasDaily = daily.some((d) => d.v > 0);

  const hourly = stats?.hourly_distribution || [];
  const hasHourly = hourly.some((h) => num(h.count) > 0);
  const maxH = Math.max(1, ...hourly.map((h) => num(h.count)));

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <StatMini label="Messages" value={num(ov.total_messages).toLocaleString("fr-FR")} />
        <StatMini label="Contacts" value={num(ov.unique_contacts)} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: S.md }}>
        <StatMini label="Leads" value={num(ov.total_leads)} />
        <StatMini label="Escalades" value={num(ov.total_escalations)} />
      </View>

      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Messages par jour</Text>
          <Ionicons name="trending-up" size={16} color={C.lime} />
        </View>
        {hasDaily ? (
          <View style={{ marginTop: 14 }}><BarChart data={daily} height={130} /></View>
        ) : (
          <Text style={{ color: C.subDark, fontSize: 13, marginTop: 16 }}>Pas encore de données journalières.</Text>
        )}
      </Card>

      <Card>
        <Text style={{ color: C.white, fontWeight: "700", fontSize: 15, marginBottom: 14 }}>Activité par heure</Text>
        {hasHourly ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-end", height: 90, gap: 2 }}>
              {hourly.map((h, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ width: "100%", height: Math.max(3, (num(h.count) / maxH) * 80), borderRadius: 2,
                    backgroundColor: (h.hour ?? i) % 6 === 0 ? C.lime : "rgba(255,255,255,0.16)" }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              {["0h", "6h", "12h", "18h", "23h"].map((t) => (
                <Text key={t} style={{ color: C.subDark, fontSize: 9 }}>{t}</Text>
              ))}
            </View>
          </>
        ) : (
          <Text style={{ color: C.subDark, fontSize: 13 }}>Pas encore d'activité horaire.</Text>
        )}
      </Card>

      {!hasDaily && !hasHourly && num(ov.total_messages) === 0 && (
        <EmptyHint text="Les statistiques apparaîtront dès les premières conversations." />
      )}
    </ScrollView>
  );
}
