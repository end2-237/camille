import React from "react";
import { View, Text, Animated, RefreshControl, ImageBackground, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S, SH, BOTTOM_INSET } from "../theme";
import { Card, EmptyHint, Glass, Scrim, StatMini, SectionTitle } from "../components/ui";
import { Press, Reveal, Jauge, styleParallaxe } from "../components/motion";
import { BarChart, Gauge } from "../components/charts";
import { AdCard, PlanCard } from "../components/promo";
import Avatar from "../components/Avatar";

const WEB = "https://camille.vps.buyticle.com";
const AD1 = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=70";
const AD2 = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=70";

const HERO_H = 420;

export default function Dashboard({ stats, user, refreshing, onRefresh, scrollY }) {
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

  // Le parent partage sa valeur de défilement pour faire fondre le grand titre.
  // Si l'écran est monté seul (test, aperçu), on s'en fabrique une.
  const y = React.useRef(new Animated.Value(0)).current;
  const suivi = scrollY || y;

  return (
    <Animated.ScrollView
      contentContainerStyle={{ padding: S.md, paddingBottom: 100 + BOTTOM_INSET }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: suivi } } }], { useNativeDriver: true })}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}
    >
      {/* Un zéro peut vouloir dire « aucune activité » ou « impossible à
          lire ». Les confondre fait chercher un problème commercial là où il
          y a un problème technique. */}
      {Array.isArray(stats?.degraded) && stats.degraded.length > 0 && (
        <Alerte
          ton="ambre"
          icone="warning-outline"
          titre="Statistiques incomplètes"
          texte="Certaines données n'ont pas pu être lues — les chiffres ci-dessous ne sont pas fiables. Applique migration_all.sql sur la base."
        />
      )}

      {/* Un agent dont l'abonnement est fini ne répond plus à personne. Tant
          que rien ne le disait, le vendeur croyait son agent actif et
          cherchait la panne du mauvais côté. */}
      {Number(stats?.subscription?.expired_count || 0) > 0 && (
        <Alerte
          ton="rouge"
          icone="lock-closed-outline"
          titre={
            Number(stats.subscription.expired_count) > 1
              ? `${stats.subscription.expired_count} agents à l'arrêt`
              : `${stats.subscription.expired_agents?.[0]?.name || "Ton agent"} est à l'arrêt`
          }
          texte="L'abonnement est terminé : plus aucune réponse n'est envoyée à tes clients. Réabonne-toi pour le remettre en service."
        />
      )}

      {/* ── HERO ────────────────────────────────────────────────────────────
          La photo dépasse volontairement du cadre et suit le doigt : quand on
          tire l'écran vers le bas, elle s'agrandit au lieu de laisser un vide
          gris. C'est le geste qui rend un écran « élastique » plutôt que
          buté — et il ne coûte rien, tout se passe côté natif. */}
      <Reveal index={0} dy={20}>
        <View style={[{ borderRadius: R.xl, overflow: "hidden", marginBottom: S.md, backgroundColor: "#8FC0EF", height: HERO_H }, SH.card]}>
          <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, height: HERO_H }, styleParallaxe(suivi, HERO_H)]}>
            <ImageBackground source={require("../../assets/dash-hero.png")} style={{ flex: 1 }} resizeMode="cover" />
          </Animated.View>

          <Scrim height={HERO_H * 0.7} to="rgba(6,6,10,0.86)" />

          <View style={{ flex: 1, padding: 22 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 32, lineHeight: 35, letterSpacing: -1.1 }}>
              Vos ventes
            </Text>
            <Text style={{ color: C.lime, fontWeight: "800", fontSize: 32, lineHeight: 35, letterSpacing: -1.1 }}>
              en pilote auto
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 20, marginTop: 12, width: "88%" }}>
              Camille répond à vos clients, présente vos produits et conclut — pendant que vous faites autre chose.
            </Text>

            <Press onPress={() => Linking.openURL(WEB)} style={{ marginTop: 18, alignSelf: "flex-start" }} scale={0.95}>
              <View style={{
                backgroundColor: "#fff", borderRadius: R.pill, paddingHorizontal: 18, height: 46,
                flexDirection: "row", alignItems: "center", gap: 10,
              }}>
                <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>Découvrir Camille</Text>
                <Ionicons name="arrow-forward" size={15} color={C.ink} />
              </View>
            </Press>

            <View style={{ flex: 1 }} />

            {/* bandeau bas en verre : agents + action */}
            <Glass
              dark
              radius={R.lg}
              shadow={SH.soft}
              style={{
                flexDirection: "row", alignItems: "center", gap: 11, padding: 10,
                backgroundColor: "rgba(255,255,255,0.16)",
              }}
            >
              <View style={{ flexDirection: "row" }}>
                {(stats?.agents || []).slice(0, 3).map((a, i) => (
                  <View key={a.agent_id || i} style={{ marginLeft: i === 0 ? 0 : -11 }}>
                    <Avatar name={a.name} size={32} radius={16} />
                  </View>
                ))}
                {!(stats?.agents || []).length && <Avatar name="Camille" size={32} radius={16} />}
              </View>
              <View style={{ width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.45)" }} />
              <Text style={{ flex: 1, color: "#fff", fontWeight: "600", fontSize: 14 }}>
                {(stats?.agents || []).length ? "Gérer mes agents" : "Connecter WhatsApp"}
              </Text>
              <View style={{
                width: 32, height: 32, borderRadius: 16, borderWidth: 1,
                borderColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </View>
            </Glass>
          </View>
        </View>
      </Reveal>

      {/* ── Deux cartes : réactivité + volume reçu ── */}
      <Reveal index={1} dy={20}>
        <View style={{ flexDirection: "row", gap: 11, marginBottom: S.md }}>
          <View style={[{ flex: 1, backgroundColor: C.ink, borderRadius: R.lg, padding: 16, justifyContent: "space-between", minHeight: 138 }, SH.card]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <Text style={{ color: C.white, fontWeight: "700", fontSize: 14, width: "70%" }}>Taux de{"\n"}réponse</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.limeSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="flash" size={14} color={C.lime} />
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 24, letterSpacing: -0.8 }}>
                {ov.escalation_rate != null ? `${100 - Math.round(ov.escalation_rate)}%` : "—"}
              </Text>
              <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: R.pill, paddingHorizontal: 10, height: 24, justifyContent: "center" }}>
                <Text style={{ color: C.subDark, fontSize: 10.5 }}>30 jours</Text>
              </View>
            </View>
          </View>

          <View style={[{ flex: 1, borderRadius: R.lg, overflow: "hidden", minHeight: 138 }, SH.card]}>
            <ImageBackground source={require("../../assets/dash-hero.png")} style={{ flex: 1 }} resizeMode="cover">
              <Scrim height={110} to="rgba(6,6,10,0.88)" />
              <View style={{ flex: 1, padding: 16, justifyContent: "flex-end" }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 24, letterSpacing: -0.8 }}>{received.toLocaleString("fr-FR")}</Text>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5 }}>messages reçus</Text>
              </View>
            </ImageBackground>
          </View>
        </View>
      </Reveal>

      {/* PUB #1 — au-dessus de la performance */}
      <Reveal index={2} dy={18}>
        <AdCard
          image={AD1}
          tag="BOOSTEZ VOS VENTES"
          title="Transformez chaque message en commande"
          description="Camille répond, conseille et vend pour vous, 24h/24 sur WhatsApp."
          cta="Découvrir"
          url={`${WEB}`}
        />
      </Reveal>

      {/* Preuve de valeur : ce que Camille a concretement rapporte.
          On separe l'encaisse du potentiel — les melanger gonflerait le chiffre. */}
      <Reveal index={3} dy={18}>
        <RevenueCard rev={rev} />
      </Reveal>

      {/* Messages reçus (source Camille Core) + traités par l'IA */}
      <Reveal index={4} dy={18}>
        <SectionTitle>Cette période</SectionTitle>
        <View style={{ flexDirection: "row", gap: 11, marginBottom: 11 }}>
          <StatMini label="Messages reçus" value={received.toLocaleString("fr-FR")} />
          <StatMini label="Messages envoyés" value={sent.toLocaleString("fr-FR")} />
        </View>
        <View style={{ flexDirection: "row", gap: 11, marginBottom: S.md }}>
          <StatMini label="Traités par l'IA" value={messages.toLocaleString("fr-FR")} />
          <StatMini label="Contacts" value={contacts.toLocaleString("fr-FR")} />
        </View>
      </Reveal>

      {/* Consommation de tokens et limite du plan */}
      <Reveal index={5} dy={18}>
        <Card style={{ marginBottom: S.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Tokens du mois</Text>
            <Ionicons name="flash-outline" size={16} color={C.lime} />
          </View>
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 26, marginTop: 8, letterSpacing: -0.8 }}>
            {tokUsed.toLocaleString("fr-FR")}
            <Text style={{ color: C.subDark, fontWeight: "600", fontSize: 14 }}>
              {unlimited ? "  · illimité" : tokLimit ? `  / ${tokLimit.toLocaleString("fr-FR")}` : ""}
            </Text>
          </Text>
          {!unlimited && !!tokLimit && (
            <>
              <View style={{ marginTop: 13 }}>
                <Jauge pct={tokPct} couleur={tokPct >= 90 ? C.red : tokPct >= 70 ? C.amber : C.lime} />
              </View>
              <Text style={{ color: C.subDark, fontSize: 11.5, marginTop: 7 }}>
                {tokPct}% du quota utilisé
              </Text>
            </>
          )}
        </Card>
      </Reveal>

      <Reveal index={6} dy={18}>
        <Card style={{ marginBottom: S.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Performance des agents</Text>
            <Ionicons name="calendar-outline" size={16} color={C.subDark} />
          </View>
          {hasBars ? (
            <View style={{ marginTop: 14 }}><BarChart data={bars} height={120} /></View>
          ) : (
            <Text style={{ color: C.subDark, fontSize: 13, marginTop: 18, marginBottom: 6 }}>
              Pas encore assez d&apos;activité pour afficher la courbe.
            </Text>
          )}
        </Card>
      </Reveal>

      {/* PLAN — sous la performance */}
      <Reveal index={7} dy={18}>
        <PlanCard plan={user?.plan || "free"} url={`${WEB}/dashboard/billing`} />
      </Reveal>

      <Reveal index={8} dy={18}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Volume de messages</Text>
            <Ionicons name="options-outline" size={16} color={C.subDark} />
          </View>
          <View style={{ alignItems: "center", marginTop: 6 }}>
            <Gauge value={messages} max={gaugeMax} size={230} />
            <View style={{ position: "absolute", top: 44, alignItems: "center" }}>
              <Text style={{ color: C.white, fontSize: 32, fontWeight: "800", letterSpacing: -1 }}>
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
      </Reveal>

      {/* PUB #2 — sous le volume de messages */}
      <View style={{ height: S.md }} />
      <Reveal index={9} dy={18}>
        <AdCard
          image={AD2}
          tag="CAMILLE V3"
          title="Monitoring en direct & sessions ultra-stables"
          description="Suivez vos agents en temps réel et ne perdez plus jamais une conversation."
          cta="En savoir plus"
          url={`${WEB}`}
          tint="rgba(108,92,231,0.60)"
        />
      </Reveal>

      {!messages && !contacts && !leads && (
        <EmptyHint text="Aucune activité sur les 30 derniers jours." />
      )}
    </Animated.ScrollView>
  );
}

/** Bandeau d'alerte, en verre teinté plutôt qu'en aplat. */
function Alerte({ ton, icone, titre, texte }) {
  const t = ton === "rouge"
    ? { fond: "rgba(248,113,113,0.13)", bord: "rgba(248,113,113,0.28)", encre: "#A3261B" }
    : { fond: "rgba(251,191,36,0.15)", bord: "rgba(251,191,36,0.32)", encre: "#8A5A00" };

  return (
    <Reveal index={0} dy={12}>
      <View style={[{
        flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14,
        borderRadius: R.lg, backgroundColor: t.fond, borderWidth: 1, borderColor: t.bord,
        marginBottom: S.md,
      }, SH.soft]}>
        <Ionicons name={icone} size={18} color={t.encre} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.encre, fontWeight: "700", fontSize: 13.5 }}>{titre}</Text>
          <Text style={{ color: t.encre, fontSize: 12.5, marginTop: 3, lineHeight: 18 }}>{texte}</Text>
        </View>
      </View>
    </Reveal>
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
      <Glass style={{ padding: S.md, marginBottom: 11, flexDirection: "row", alignItems: "center", gap: 13 }}>
        <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: "#F0F6DC", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="trending-up" size={20} color="#4A6B00" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14.5 }}>Chiffre d&apos;affaires</Text>
          <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
            Aucune commande sur la période — il apparaîtra ici.
          </Text>
        </View>
      </Glass>
    );
  }

  return (
    <View style={[{ backgroundColor: C.ink, borderRadius: R.lg, padding: S.md, marginBottom: 11, overflow: "hidden" }, SH.card]}>
      <View style={{
        position: "absolute", right: -26, top: -26, width: 120, height: 120, borderRadius: 60,
        backgroundColor: C.limeSoft,
      }} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.subDark, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>
          GÉNÉRÉ PAR CAMILLE
        </Text>
        <Ionicons name="trending-up" size={16} color={C.lime} />
      </View>

      <Text style={{ color: C.lime, fontWeight: "800", fontSize: 32, letterSpacing: -1.1, marginTop: 8 }}>
        {money(delivered)} <Text style={{ fontSize: 15, color: C.subDark, fontWeight: "700" }}>{cur}</Text>
      </Text>
      <Text style={{ color: C.subDark, fontSize: 12.5, marginTop: 2 }}>
        encaissé sur {rev.delivered_count || 0} commande{(rev.delivered_count || 0) > 1 ? "s" : ""} livrée{(rev.delivered_count || 0) > 1 ? "s" : ""}
      </Text>

      <View style={{ flexDirection: "row", gap: 9, marginTop: 15 }}>
        <RevBit label="En cours" value={`${money(pending)} ${cur}`} hint={`${rev.pending_count || 0} commande(s)`} />
        <RevBit label="Panier moyen" value={`${money(rev.avg_basket)} ${cur}`} hint={`${orders} au total`} />
      </View>
    </View>
  );
}

function RevBit({ label, value, hint }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: R.md, padding: 12 }}>
      <Text style={{ color: C.subDark, fontSize: 10.5, fontWeight: "700" }}>{label.toUpperCase()}</Text>
      <Text style={{ color: C.white, fontSize: 15.5, fontWeight: "800", marginTop: 3 }}>{value}</Text>
      <Text style={{ color: C.subDark, fontSize: 10, marginTop: 1 }}>{hint}</Text>
    </View>
  );
}
