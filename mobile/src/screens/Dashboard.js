import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { Card, EmptyHint } from "../components/ui";
import { BarChart, Gauge } from "../components/charts";
import { AdCard, PlanCard } from "../components/promo";

const WEB = "https://camille.vps.buyticle.com";
const AD1 = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=70";
const AD2 = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=70";

export default function Dashboard({ stats, user, refreshing, onRefresh }) {
  const ov = stats?.overview || {};
  const messages = Number(ov.total_messages || 0);
  const leads = Number(ov.total_leads || 0);
  const contacts = Number(ov.unique_contacts || 0);
  const escal = Number(ov.total_escalations || 0);
  const tokens = Number(ov.total_tokens || 0);

  const bars = (stats?.monthly_tokens || []).map((m) => ({ l: String(m.period || "").slice(-2), v: Math.round(Number(m.total_tokens || 0) / 1000) }));
  const hasBars = bars.some((b) => b.v > 0);
  const gaugeMax = Math.max(messages * 1.25, 10);

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>

      {/* PUB #1 — au-dessus de la performance */}
      <AdCard
        image={AD1}
        tag="BOOSTEZ VOS VENTES"
        title="Transformez chaque message en commande"
        description="Camille répond, conseille et vend pour vous, 24h/24 sur WhatsApp."
        cta="Découvrir"
        url={`${WEB}`}
      />

      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Performance des agents</Text>
          <Ionicons name="calendar-outline" size={16} color={C.subDark} />
        </View>
        {hasBars ? (
          <View style={{ marginTop: 14 }}><BarChart data={bars} height={120} /></View>
        ) : (
          <Text style={{ color: C.subDark, fontSize: 13, marginTop: 18, marginBottom: 6 }}>
            Pas encore assez d'activité pour afficher la courbe.
          </Text>
        )}
      </Card>

      {/* PLAN — sous la performance */}
      <PlanCard plan={user?.plan || "free"} url={`${WEB}/dashboard/billing`} />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Volume de messages</Text>
          <Ionicons name="options-outline" size={16} color={C.subDark} />
        </View>
        <View style={{ alignItems: "center", marginTop: 6 }}>
          <Gauge value={messages} max={gaugeMax} size={230} />
          <View style={{ position: "absolute", top: 44, alignItems: "center" }}>
            <Text style={{ color: C.white, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }}>
              {messages.toLocaleString("fr-FR")}
            </Text>
            <Text style={{ color: C.subDark, fontSize: 11, marginTop: 2 }}>messages · 30 j</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Legend color={C.lime} label="Contacts" val={contacts} />
          <Legend color="#7FB2FF" label="Leads" val={leads} />
          <Legend color="#F0A6FF" label="Escalades" val={escal} />
          <Legend color="#FFD166" label="Tokens" val={fmtK(tokens)} />
        </View>
      </Card>

      {/* PUB #2 — sous le volume de messages */}
      <View style={{ height: S.md }} />
      <AdCard
        image={AD2}
        tag="CAMILLE V3"
        title="Monitoring en direct & sessions ultra-stables"
        description="Suivez vos agents en temps réel et ne perdez plus jamais une conversation."
        cta="En savoir plus"
        url={`${WEB}`}
        tint="rgba(108,92,231,0.60)"
      />

      {!messages && !contacts && !leads && (
        <EmptyHint text="Aucune activité sur les 30 derniers jours." />
      )}
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
