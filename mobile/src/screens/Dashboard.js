import React from "react";
import { View, Text, ScrollView, RefreshControl, ImageBackground, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S, BOTTOM_INSET } from "../theme";
import { Card, EmptyHint } from "../components/ui";
import { BarChart, Gauge } from "../components/charts";
import { AdCard, PlanCard } from "../components/promo";
import { StatMini } from "../components/ui";
import Avatar from "../components/Avatar";

const WEB = "https://camille.vps.buyticle.com";
const AD1 = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=70";
const AD2 = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=70";

export default function Dashboard({ stats, user, refreshing, onRefresh }) {
  const ov = stats?.overview || {};
  const rev = stats?.revenue || {};
  const messages = Number(ov.total_messages || 0);
  const leads = Number(ov.total_leads || 0);
  const contacts = Number(ov.unique_contacts || 0);
  const escal = Number(ov.total_escalations || 0);
  const tokens = Number(ov.total_tokens || 0);

  const received = Number(ov.messages_received || 0);
  const sent = Number(ov.messages_sent || 0);

  const bars = (stats?.monthly_tokens || []).map((m) => ({ l: String(m.period || "").slice(-2), v: Math.round(Number(m.total_tokens || 0) / 1000) }));
  const hasBars = bars.some((b) => b.v > 0);
  const gaugeMax = Math.max(messages * 1.25, 10);

  // Quota de tokens : agrégé depuis les agents (l'API fournit limite + consommation du mois)
  const ags = stats?.agents || [];
  const tokUsed = ags.reduce((s, a) => s + Number(a.token_used_month || 0), 0);
  const unlimited = ags.some((a) => a.token_unlimited);
  const tokLimit = unlimited ? 0 : ags.reduce((s, a) => s + Number(a.token_limit || 0), 0);
  const tokPct = unlimited || !tokLimit ? 0 : Math.min(100, Math.round((tokUsed / tokLimit) * 100));

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 + BOTTOM_INSET }} showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>

      {/* Un zéro peut vouloir dire « aucune activité » ou « impossible à
          lire ». Les confondre fait chercher un problème commercial là où il
          y a un problème technique. */}
      {Array.isArray(stats?.degraded) && stats.degraded.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12,
          borderRadius: R.md, backgroundColor: "#FDF1DC", borderWidth: 1, borderColor: "#F0D9A8",
          marginBottom: S.md }}>
          <Ionicons name="warning-outline" size={17} color="#8A5A00" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#8A5A00", fontWeight: "700", fontSize: 13 }}>
              Statistiques incomplètes
            </Text>
            <Text style={{ color: "#8A5A00", fontSize: 12, marginTop: 2, lineHeight: 17 }}>
              Certaines données n'ont pas pu être lues — les chiffres ci-dessous
              ne sont pas fiables. Applique migration_all.sql sur la base.
            </Text>
          </View>
        </View>
      )}

      {/* ── HERO façon carte immobilière : image + titre + CTA + bandeau ── */}
      <View style={{ borderRadius: 22, overflow: "hidden", marginBottom: S.md, backgroundColor: "#8FC0EF" }}>
        <ImageBackground source={require("../../assets/dash-hero.png")} style={{ width: "100%", minHeight: 430 }} resizeMode="cover">
          <View style={{ flex: 1, padding: 20, justifyContent: "flex-start" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 30, lineHeight: 34, letterSpacing: -0.8 }}>
              Vos ventes
            </Text>
            <Text style={{ color: C.ink, fontWeight: "800", fontSize: 30, lineHeight: 34, letterSpacing: -0.8 }}>
              en pilote auto
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 13.5, lineHeight: 19, marginTop: 12, width: "88%" }}>
              Camille répond à vos clients, présente vos produits et conclut — pendant que vous faites autre chose.
            </Text>

            <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(WEB)}
              style={{ marginTop: 18, alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 10,
                paddingHorizontal: 16, height: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ color: C.ink, fontWeight: "600", fontSize: 13.5 }}>Découvrir Camille</Text>
              <Ionicons name="arrow-forward" size={15} color={C.ink} />
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            {/* bandeau bas translucide : agents + action */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.22)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 14, padding: 8 }}>
              <View style={{ flexDirection: "row" }}>
                {(stats?.agents || []).slice(0, 3).map((a, i) => (
                  <View key={a.agent_id || i} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                    <Avatar name={a.name} size={30} radius={15} />
                  </View>
                ))}
                {!(stats?.agents || []).length && <Avatar name="Camille" size={30} radius={15} />}
              </View>
              <View style={{ width: 1, height: 22, backgroundColor: "rgba(255,255,255,0.5)" }} />
              <Text style={{ flex: 1, color: "#fff", fontWeight: "600", fontSize: 13.5 }}>
                {(stats?.agents || []).length ? "Gérer mes agents" : "Connecter WhatsApp"}
              </Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </View>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* ── Deux cartes : satisfaction + volume ── */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: S.md }}>
        <View style={{ flex: 1, backgroundColor: C.ink, borderRadius: 18, padding: 14, justifyContent: "space-between", minHeight: 130 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 13.5, width: "72%" }}>Taux de{"\n"}réponse</Text>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(198,242,78,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="flash" size={13} color={C.lime} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 22 }}>
              {ov.escalation_rate != null ? `${100 - Math.round(ov.escalation_rate)}%` : "—"}
            </Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 10, height: 24, justifyContent: "center" }}>
              <Text style={{ color: C.subDark, fontSize: 10.5 }}>30 jours</Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1, borderRadius: 18, overflow: "hidden", minHeight: 130 }}>
          <ImageBackground source={require("../../assets/dash-hero.png")} style={{ flex: 1 }} resizeMode="cover">
            <View style={{ flex: 1, backgroundColor: "rgba(16,16,18,0.35)", padding: 14, justifyContent: "flex-end" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22 }}>{received.toLocaleString("fr-FR")}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>messages reçus</Text>
            </View>
          </ImageBackground>
        </View>
      </View>

      {/* PUB #1 — au-dessus de la performance */}
      <AdCard
        image={AD1}
        tag="BOOSTEZ VOS VENTES"
        title="Transformez chaque message en commande"
        description="Camille répond, conseille et vend pour vous, 24h/24 sur WhatsApp."
        cta="Découvrir"
        url={`${WEB}`}
      />

      {/* Preuve de valeur : ce que Camille a concretement rapporte.
          On separe l'encaisse du potentiel — les melanger gonflerait le chiffre. */}
      <RevenueCard rev={rev} />

      {/* Messages reçus (source Camille Core) + traités par l'IA */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <StatMini label="Messages reçus" value={received.toLocaleString("fr-FR")} />
        <StatMini label="Messages envoyés" value={sent.toLocaleString("fr-FR")} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: S.md }}>
        <StatMini label="Traités par l'IA" value={messages.toLocaleString("fr-FR")} />
        <StatMini label="Contacts" value={contacts.toLocaleString("fr-FR")} />
      </View>

      {/* Consommation de tokens et limite du plan */}
      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Tokens du mois</Text>
          <Ionicons name="flash-outline" size={16} color={C.lime} />
        </View>
        <Text style={{ color: C.white, fontWeight: "800", fontSize: 24, marginTop: 8 }}>
          {tokUsed.toLocaleString("fr-FR")}
          <Text style={{ color: C.subDark, fontWeight: "600", fontSize: 14 }}>
            {unlimited ? "  · illimité" : tokLimit ? `  / ${tokLimit.toLocaleString("fr-FR")}` : ""}
          </Text>
        </Text>
        {!unlimited && !!tokLimit && (
          <>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 12, overflow: "hidden" }}>
              <View style={{ width: `${tokPct}%`, height: 8, borderRadius: 4, backgroundColor: tokPct >= 90 ? C.red : tokPct >= 70 ? C.amber : C.lime }} />
            </View>
            <Text style={{ color: C.subDark, fontSize: 11, marginTop: 6 }}>
              {tokPct}% du quota utilisé
            </Text>
          </>
        )}
      </Card>

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


// ── Chiffre d'affaires genere par les commandes ─────────────────────────────
function RevenueCard({ rev }) {
  const cur = rev.currency || "XAF";
  const money = (n) => Number(n || 0).toLocaleString("fr-FR");
  const delivered = Number(rev.delivered || 0);
  const pending = Number(rev.pending || 0);
  const orders = Number(rev.orders_count || 0);

  if (!orders) {
    return (
      <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line,
        padding: S.md, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F3F7E4",
          alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="trending-up" size={20} color="#4A6B00" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>Chiffre d&apos;affaires</Text>
          <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
            Aucune commande sur la période — il apparaîtra ici.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: C.ink, borderRadius: R.lg, padding: S.md, marginBottom: 10, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: -24, top: -24, width: 110, height: 110, borderRadius: 55,
        backgroundColor: "rgba(198,242,78,0.10)" }} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.subDark, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
          GÉNÉRÉ PAR CAMILLE
        </Text>
        <Ionicons name="trending-up" size={16} color={C.lime} />
      </View>

      <Text style={{ color: C.lime, fontWeight: "800", fontSize: 30, letterSpacing: -0.8, marginTop: 8 }}>
        {money(delivered)} <Text style={{ fontSize: 15, color: C.subDark, fontWeight: "700" }}>{cur}</Text>
      </Text>
      <Text style={{ color: C.subDark, fontSize: 12, marginTop: 1 }}>
        encaissé sur {rev.delivered_count || 0} commande{(rev.delivered_count || 0) > 1 ? "s" : ""} livrée{(rev.delivered_count || 0) > 1 ? "s" : ""}
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <RevBit label="En cours" value={`${money(pending)} ${cur}`} hint={`${rev.pending_count || 0} commande(s)`} />
        <RevBit label="Panier moyen" value={`${money(rev.avg_basket)} ${cur}`} hint={`${orders} au total`} />
      </View>
    </View>
  );
}

function RevBit({ label, value, hint }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 11 }}>
      <Text style={{ color: C.subDark, fontSize: 10.5, fontWeight: "700" }}>{label.toUpperCase()}</Text>
      <Text style={{ color: C.white, fontSize: 15, fontWeight: "800", marginTop: 3 }}>{value}</Text>
      <Text style={{ color: C.subDark, fontSize: 10, marginTop: 1 }}>{hint}</Text>
    </View>
  );
}
