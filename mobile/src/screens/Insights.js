import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S, BOTTOM_INSET } from "../theme";
import { Card, EmptyHint } from "../components/ui";
import { getConversationAnalytics } from "../api";

const STEP_LABEL = {
  contact: "Premier contact",
  decouverte: "Découverte",
  interet: "Intérêt produit",
  question: "Question (prix, stock…)",
  panier: "Panier",
  commande: "Commande",
};

const CAUSE_LABEL = {
  intention_mal_comprise: "Intention mal comprise",
  client_se_repete: "Le client se répète",
  produit_introuvable: "Produit introuvable",
  correction_explicite: "Le client corrige l'agent",
  abandon_apres_interet: "Abandon après intérêt",
  passage_humain: "Demande un humain",
};

const CAUSE_FIX = {
  intention_mal_comprise: "Règle à ajouter dans l'agent",
  client_se_repete: "Réponse peu claire",
  produit_introuvable: "Manque dans le catalogue",
  correction_explicite: "Mauvais produit proposé",
  abandon_apres_interet: "Prix ou dispo à clarifier",
  passage_humain: "Cas non couvert",
};

export default function Insights({ refreshing, onRefresh }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await getConversationAnalytics("30d")); }
    catch (e) { setData({ error: e.message }); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data && busy) return <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />;

  const funnel = data?.entonnoir || [];
  const maxConv = Math.max(1, ...funnel.map((f) => f.conversations));

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 + BOTTOM_INSET }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={!!refreshing || busy} onRefresh={() => { load(); onRefresh && onRefresh(); }} tintColor={C.ink} />}>

      {/* Résumé */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: S.md }}>
        <View style={{ flex: 1, backgroundColor: C.ink, borderRadius: R.lg, padding: 14 }}>
          <Text style={{ color: C.subDark, fontSize: 11 }}>Discussions</Text>
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 24, marginTop: 4 }}>{data?.conversations ?? 0}</Text>
          <Text style={{ color: C.subDark, fontSize: 10, marginTop: 2 }}>30 derniers jours</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14 }}>
          <Text style={{ color: C.sub, fontSize: 11 }}>Avec friction</Text>
          <Text style={{ color: (data?.taux_friction ?? 0) >= 40 ? C.red : C.ink, fontWeight: "800", fontSize: 24, marginTop: 4 }}>
            {data?.taux_friction ?? 0}%
          </Text>
          <Text style={{ color: C.sub, fontSize: 10, marginTop: 2 }}>{data?.avec_friction ?? 0} discussions</Text>
        </View>
      </View>

      {data?.error || data?.empty ? (
        <Card>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15, marginBottom: 6 }}>Analyse indisponible</Text>
          <Text style={{ color: C.subDark, fontSize: 12.5, lineHeight: 18 }}>
            {data?.error || data?.note || "Aucune donnée pour le moment."}
          </Text>
          <Text style={{ color: C.subDark, fontSize: 11.5, marginTop: 10, lineHeight: 17 }}>
            Les analyses apparaissent dès que tes agents ont échangé avec des clients
            (le workflow enregistre chaque décision).
          </Text>
        </Card>
      ) : (
        <>
          {/* Entonnoir — où ça décroche */}
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>
            PARCOURS CLIENT
          </Text>
          <Card style={{ marginBottom: S.md }}>
            {funnel.map((f, i) => {
              const prev = i > 0 ? funnel[i - 1].conversations : f.conversations;
              const drop = prev > 0 ? Math.round(((prev - f.conversations) / prev) * 100) : 0;
              const bigDrop = i > 0 && drop >= 40;
              return (
                <View key={f.etape} style={{ marginBottom: i === funnel.length - 1 ? 0 : 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <Text style={{ color: C.white, fontSize: 12.5, fontWeight: "600" }}>{STEP_LABEL[f.etape] || f.etape}</Text>
                    <Text style={{ color: C.subDark, fontSize: 11.5 }}>{f.conversations} · {f.pourcentage}%</Text>
                  </View>
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                    <View style={{ width: `${Math.round((f.conversations / maxConv) * 100)}%`, height: 10, borderRadius: 5,
                      backgroundColor: bigDrop ? C.red : C.lime }} />
                  </View>
                  {bigDrop && (
                    <Text style={{ color: C.red, fontSize: 10.5, marginTop: 4 }}>
                      ↓ {drop}% des clients s'arrêtent ici
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>

          {/* Causes de friction */}
          {!!(data?.causes || []).length && (
            <>
              <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>
                CAUSES DE FRICTION
              </Text>
              {data.causes.map((c) => (
                <View key={c.cause} style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md, marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14, flex: 1 }}>
                      {CAUSE_LABEL[c.cause] || c.cause}
                    </Text>
                    <View style={{ backgroundColor: C.ink, borderRadius: R.pill, paddingHorizontal: 10, height: 24, justifyContent: "center" }}>
                      <Text style={{ color: C.lime, fontWeight: "800", fontSize: 11 }}>{c.conversations}</Text>
                    </View>
                  </View>
                  <Text style={{ color: C.sub, fontSize: 11.5, marginTop: 4 }}>→ {CAUSE_FIX[c.cause] || "à examiner"}</Text>
                  {(c.exemples || []).slice(0, 2).map((ex, i) => (
                    <Text key={i} style={{ color: C.sub, fontSize: 11, marginTop: 6, fontStyle: "italic" }} numberOfLines={1}>
                      « {ex} »
                    </Text>
                  ))}
                </View>
              ))}
            </>
          )}

          {/* Questions sans réponse */}
          {!!(data?.questions_sans_reponse || []).length && (
            <>
              <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginTop: 6, marginLeft: 2 }}>
                DEMANDES SANS RÉPONSE
              </Text>
              <Card style={{ marginBottom: S.md }}>
                <Text style={{ color: C.subDark, fontSize: 11.5, marginBottom: 10 }}>
                  Ce que tes clients cherchent et que l'agent n'a pas trouvé — ajoute-les à ton catalogue.
                </Text>
                {data.questions_sans_reponse.slice(0, 8).map((q, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: R.pill, paddingHorizontal: 8, height: 20, justifyContent: "center" }}>
                      <Text style={{ color: C.lime, fontSize: 10, fontWeight: "800" }}>×{q.count}</Text>
                    </View>
                    <Text style={{ color: C.white, fontSize: 12.5, flex: 1 }} numberOfLines={1}>{q.question}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Signatures d'échec */}
          {!!(data?.signatures || []).length && (
            <>
              <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>
                SCÉNARIOS QUI SE RÉPÈTENT
              </Text>
              {data.signatures.slice(0, 5).map((s, i) => (
                <View key={i} style={{ backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: C.sub, fontSize: 10.5, fontWeight: "700" }}>{s.count} discussion{s.count > 1 ? "s" : ""}</Text>
                    <View style={{ backgroundColor: s.issue === "abandon" ? "#FDECEC" : "#F1F1F1", borderRadius: R.pill, paddingHorizontal: 8, height: 20, justifyContent: "center" }}>
                      <Text style={{ color: s.issue === "abandon" ? C.red : C.sub, fontSize: 10, fontWeight: "700" }}>{s.issue}</Text>
                    </View>
                  </View>
                  <Text style={{ color: C.ink, fontSize: 12 }}>{s.signature}</Text>
                </View>
              ))}
            </>
          )}

          {!data?.conversations && <EmptyHint text="Aucune discussion analysée sur la période." />}
        </>
      )}
    </ScrollView>
  );
}
