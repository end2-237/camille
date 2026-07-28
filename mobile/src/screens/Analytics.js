import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { Card, StatMini, EmptyHint } from "../components/ui";
import { BarChart } from "../components/charts";
import Avatar from "../components/Avatar";
import Insights from "./Insights";

function num(x) { return typeof x === "number" ? x : Number(x) || 0; }
function fr(n) { return num(n).toLocaleString("fr-FR"); }

// Outil interne : l'analyse de friction n'est pas destinée aux clients.
const INTERNAL_EMAILS = ["emansoga@gmail.com"];

export default function Analytics({ stats, refreshing, onRefresh, user }) {
  const [view, setView] = useState("volume");
  const internal = INTERNAL_EMAILS.includes(String(user?.email || "").toLowerCase());
  const ov = stats?.overview || {};
  const usage = stats?.usage || {};
  const agents = stats?.agents || [];

  const received = num(ov.messages_received);
  const sent = num(ov.messages_sent);
  const handled = num(ov.total_messages);

  // Quota global : bloc `usage` de l'API, repli sur l'agrégat des agents
  const tokUsed = usage.tokens_used != null
    ? num(usage.tokens_used)
    : agents.reduce((s, a) => s + num(a.token_used_month), 0);
  const unlimited = usage.unlimited || agents.some((a) => a.token_unlimited);
  const tokLimit = unlimited ? -1 : (usage.tokens_limit != null && usage.tokens_limit > 0
    ? num(usage.tokens_limit)
    : agents.reduce((s, a) => s + num(a.token_limit), 0));
  const pct = unlimited || tokLimit <= 0 ? 0 : Math.min(100, Math.round((tokUsed / tokLimit) * 100));
  const remaining = unlimited || tokLimit <= 0 ? 0 : Math.max(0, tokLimit - tokUsed);
  const barColor = pct >= 90 ? C.red : pct >= 70 ? C.amber : C.lime;

  const daily = (stats?.daily_series || []).map((d) => ({
    l: String(d.date || d.day || "").slice(5),
    v: num(d.messages ?? d.count ?? d.total ?? d.total_messages),
  }));
  const hasDaily = daily.some((d) => d.v > 0);

  const hourly = stats?.hourly_distribution || [];
  const hasHourly = hourly.some((h) => num(h.count) > 0);
  const maxH = Math.max(1, ...hourly.map((h) => num(h.count)));

  const Switcher = !internal ? null : (
    <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: R.pill, padding: 4,
      marginHorizontal: S.md, marginBottom: 12, borderWidth: 1, borderColor: C.line }}>
      {[["volume", "Volume"], ["insights", "Discussions"]].map(([k, l]) => (
        <TouchableOpacity key={k} onPress={() => setView(k)}
          style={{ flex: 1, height: 34, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
            backgroundColor: view === k ? C.ink : "transparent" }}>
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: view === k ? C.white : C.sub }}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (view === "insights" && internal) {
    return (
      <View style={{ flex: 1 }}>
        {Switcher}
        <Insights refreshing={refreshing} onRefresh={onRefresh} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {Switcher}
    <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 0, paddingBottom: 92 }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>

      {/* ── Messages : reçus / envoyés ────────────────────────────────── */}
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>MESSAGES</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <StatMini label="Reçus" value={fr(received)} />
        <StatMini label="Envoyés" value={fr(sent)} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: S.md }}>
        <StatMini label="Traités par l'IA" value={fr(handled)} />
        <StatMini label="Contacts" value={fr(ov.unique_contacts)} />
      </View>

      {/* ── Utilisation & limites ─────────────────────────────────────── */}
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>
        UTILISATION & LIMITES
      </Text>
      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Tokens du mois</Text>
          <View style={{ backgroundColor: "rgba(198,242,78,0.15)", borderRadius: R.pill, paddingHorizontal: 10, height: 24, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.lime, fontWeight: "800", fontSize: 10.5 }}>
              {String(usage.plan || "free").toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={{ color: C.white, fontWeight: "800", fontSize: 26, marginTop: 10 }}>
          {fr(tokUsed)}
          <Text style={{ color: C.subDark, fontWeight: "600", fontSize: 14 }}>
            {unlimited ? "  · illimité" : tokLimit > 0 ? `  / ${fr(tokLimit)}` : ""}
          </Text>
        </Text>

        {!unlimited && tokLimit > 0 && (
          <>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 12, overflow: "hidden" }}>
              <View style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: barColor }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ color: C.subDark, fontSize: 11 }}>{pct}% utilisé</Text>
              <Text style={{ color: C.subDark, fontSize: 11 }}>{fr(remaining)} restants</Text>
            </View>
            {pct >= 80 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "rgba(248,113,113,0.12)", borderRadius: R.md, padding: 10 }}>
                <Ionicons name="warning-outline" size={15} color={C.red} />
                <Text style={{ color: C.red, fontSize: 11.5, flex: 1 }}>
                  Quota bientôt atteint — pense à passer à un plan supérieur.
                </Text>
              </View>
            )}
          </>
        )}

        {usage.period ? (
          <Text style={{ color: C.subDark, fontSize: 10.5, marginTop: 10 }}>Période {usage.period}</Text>
        ) : null}
      </Card>

      {/* ── Détail par agent ──────────────────────────────────────────── */}
      {agents.length > 0 && (
        <>
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>
            DÉTAIL PAR AGENT
          </Text>
          {agents.map((a) => {
            const u = num(a.token_used_month);
            const l = num(a.token_limit);
            const unl = !!a.token_unlimited;
            const p = unl || l <= 0 ? 0 : Math.min(100, Math.round((u / l) * 100));
            return (
              <View key={a.agent_id} style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar name={a.name} size={38} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>{a.name}</Text>
                    <Text style={{ color: C.sub, fontSize: 11, marginTop: 1 }}>
                      {fr(a.messages_received ?? 0)} reçus · {fr(a.messages ?? a.period_messages ?? 0)} traités
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }}>{fr(u)}</Text>
                    <Text style={{ color: C.sub, fontSize: 10 }}>{unl ? "illimité" : l > 0 ? `/ ${fr(l)}` : "tokens"}</Text>
                  </View>
                </View>
                {!unl && l > 0 && (
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: "#EEE", marginTop: 10, overflow: "hidden" }}>
                    <View style={{ width: `${p}%`, height: 6, borderRadius: 3, backgroundColor: p >= 90 ? C.red : p >= 70 ? C.amber : C.green }} />
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      {/* ── Courbes ───────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: S.md, marginTop: 4 }}>
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

      {!received && !sent && !handled && (
        <EmptyHint text="Les statistiques apparaîtront dès les premières conversations." />
      )}
    </ScrollView>
    </View>
  );
}
