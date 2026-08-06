import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Animated, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S, SH, BOTTOM_INSET } from "../theme";
import { Card, StatMini, EmptyHint, Glass } from "../components/ui";
import { Press, Reveal } from "../components/motion";
import Avatar from "../components/Avatar";
import { BottomDrawer } from "../components/Drawer";
import AgentDetail from "./AgentDetail";
import AgentCreate from "./AgentCreate";

export default function Agents({ stats, query, refreshing, onRefresh, onAgentChanged, onRefreshData, deepLink, onDeepLinkDone, scrollY }) {
  const all = stats?.agents || [];
  const ov = stats?.overview || {};
  const q = (query || "").trim().toLowerCase();
  const [sel, setSel] = useState(null);
  const [selView, setSelView] = useState(null);
  const [creating, setCreating] = useState(false);

  // Aiguillage depuis une notification : ouvrir l'agent concerne directement sur
  // la bonne sous-vue. Une alerte qu'il faut ensuite chercher dans les menus ne
  // vaut guere mieux que pas d'alerte du tout.
  useEffect(() => {
    if (!deepLink?.agentId) return;
    const target = all.find((a) => a.agent_id === deepLink.agentId);
    if (!target) return; // agent pas encore charge : on retentera au prochain rendu
    setSel(target);
    setSelView(deepLink.view || null);
    onDeepLinkDone?.();
  }, [deepLink, all, onDeepLinkDone]);

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

  const local = React.useRef(new Animated.Value(0)).current;
  const suivi = scrollY || local;

  return (
    <>
      <Animated.ScrollView
        contentContainerStyle={{ padding: S.md, paddingBottom: 100 + BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: suivi } } }], { useNativeDriver: true })}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}
      >
        <Reveal index={0} dy={20}>
          <View style={[{ backgroundColor: C.lime, borderRadius: R.xl, padding: S.md, marginBottom: S.md, overflow: "hidden" }, SH.card]}>
            {/* Cercle de lumière : casse l'aplat de vert sans ajouter d'image. */}
            <View pointerEvents="none" style={{
              position: "absolute", right: -40, bottom: -60, width: 170, height: 170,
              borderRadius: 85, backgroundColor: "rgba(255,255,255,0.28)",
            }} />

            {/* Le bouton « Nouvel agent » est posé en absolu dans le coin haut
                droit. Sans cette réserve à droite, le titre passait DESSOUS et
                les deux textes se chevauchaient. */}
            <Text style={{ color: C.ink, fontWeight: "800", fontSize: 20, letterSpacing: -0.6, paddingRight: 145 }}>
              Agents en ligne
            </Text>
            <Text style={{ color: "rgba(0,0,0,0.58)", fontSize: 12.5, marginTop: 5, width: "70%", lineHeight: 18 }}>
              Vos vendeurs IA répondent à vos clients en temps réel sur WhatsApp
            </Text>
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16,
              backgroundColor: C.ink, alignSelf: "flex-start", paddingHorizontal: 15, height: 36, borderRadius: R.pill,
            }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} />
              <Text style={{ color: C.white, fontWeight: "600", fontSize: 13 }}>{active} actif{active > 1 ? "s" : ""}</Text>
            </View>

            <Press onPress={() => setCreating(true)} style={{ position: "absolute", right: 14, top: 14 }} scale={0.93}>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: C.ink, paddingHorizontal: 13, height: 36, borderRadius: R.pill,
              }}>
                <Ionicons name="add" size={16} color={C.lime} />
                <Text style={{ color: C.white, fontWeight: "700", fontSize: 12.5 }}>Nouvel agent</Text>
              </View>
            </Press>
          </View>
        </Reveal>

        {all.length > 0 && (
          <Reveal index={1} dy={20}>
            <Card style={{ marginBottom: S.md }}>
              <Text style={{ color: C.white, fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Vue d&apos;ensemble</Text>
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
                  <View style={{ height: 1, backgroundColor: C.lineDark, marginVertical: 15 }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <Avatar name={top.name} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>{top.name}</Text>
                      <Text style={{ color: C.subDark, fontSize: 11 }}>Agent le plus actif</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.lime, paddingHorizontal: 11, height: 28, borderRadius: R.pill }}>
                      <Ionicons name="chatbubble" size={11} color={C.ink} />
                      <Text style={{ color: C.ink, fontWeight: "700", fontSize: 12 }}>{top.messages ?? 0}</Text>
                    </View>
                  </View>
                </>
              )}
            </Card>
          </Reveal>
        )}

        {all.length > 0 && (
          <Text style={{ color: C.sub, fontSize: 12.5, fontWeight: "600", marginBottom: 10, marginLeft: 4 }}>
            {agents.length} agent{agents.length > 1 ? "s" : ""}{q ? ` · « ${query} »` : ""} · appuie pour gérer
          </Text>
        )}

        {agents.map((a, i) => (
          // La cascade est plafonnée dans Reveal : au-delà d'une demi-seconde
          // le dernier agent d'une longue liste attendrait pour rien.
          <Reveal key={a.agent_id} index={i + 2} dy={16}>
            <Press onPress={() => setSel(a)} style={{ marginBottom: 11 }}>
              <Glass style={{ padding: S.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar name={a.name} size={42} radius={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14.5 }}>{a.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (a.status || "active") === "active" ? C.green : C.amber }} />
                      <Text style={{ color: C.sub, fontSize: 11.5 }}>{a.business_name || a.sector || "Agent"}</Text>
                    </View>
                  </View>
                  {/* Deux chiffres, pas un. « Messages » seul était ambigu :
                      le vendeur y lisait ce que ses clients lui ont écrit,
                      alors qu'on affichait ce que l'IA a traité. Les deux
                      diffèrent dès qu'un message passe à l'humain. */}
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: C.ink, fontWeight: "800", fontSize: 16, letterSpacing: -0.4 }}>
                      {a.messages_received ?? 0}
                    </Text>
                    <Text style={{ color: C.sub, fontSize: 10 }}>reçus</Text>
                    <Text style={{ color: C.sub, fontSize: 10, marginTop: 1 }}>
                      {a.messages ?? 0} traités
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.sub} />
                </View>
              </Glass>
            </Press>
          </Reveal>
        ))}

        {!all.length && (
          <View style={{ alignItems: "center", marginTop: 20 }}>
            <EmptyHint text="Aucun agent pour le moment." />
            <Press onPress={() => setCreating(true)} style={{ marginTop: 16 }} scale={0.95}>
              <View style={[{
                height: 52, paddingHorizontal: 24, borderRadius: R.pill, backgroundColor: C.lime,
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
              }, SH.card]}>
                <Ionicons name="add-circle-outline" size={18} color={C.ink} />
                <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14.5 }}>Créer mon premier agent</Text>
              </View>
            </Press>
          </View>
        )}
        {all.length > 0 && !agents.length && <EmptyHint text="Aucun agent ne correspond à ta recherche." />}
      </Animated.ScrollView>

      <BottomDrawer visible={creating} onClose={() => setCreating(false)}>
        {({ close }) => <AgentCreate onClose={close} onCreated={onRefreshData} />}
      </BottomDrawer>

      <BottomDrawer visible={!!sel} onClose={() => { setSel(null); setSelView(null); }}>
        {({ close }) => sel && (
          <AgentDetail
            agent={sel}
            onClose={close}
            onChanged={onAgentChanged}
            initialView={selView}
          />
        )}
      </BottomDrawer>
    </>
  );
}
