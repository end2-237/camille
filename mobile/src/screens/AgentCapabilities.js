import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Switch, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { getAgent, patchAgent } from "../api";
import { Header } from "./AgentEdit";

const DEFAULTS = {
  product_search: "Recherche de produits",
  recommendations: "Recommandations",
  order_taking: "Prise de commande",
  appointment_booking: "Prise de rendez-vous",
  faq: "Réponses FAQ",
  multilingual: "Multilingue",
  human_handoff: "Transfert à un humain",
  promotions: "Promotions & soldes",
};

export default function AgentCapabilities({ agent, onClose }) {
  const [caps, setCaps] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAgent(agent.agent_id).then((r) => {
      const d = r?.agent || r;
      const c = d.capabilities || {};
      const merged = { ...Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, false])), ...c };
      setCaps(merged);
    }).catch((e) => Alert.alert("Erreur", e.message));
  }, [agent.agent_id]);

  function toggle(k) { setCaps((p) => ({ ...p, [k]: !p[k] })); }

  async function save() {
    setBusy(true);
    try { await patchAgent(agent.agent_id, { capabilities: caps }); Alert.alert("Enregistré", "Capacités mises à jour."); onClose && onClose(); }
    catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  }

  if (!caps) return <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />;
  const keys = Object.keys(caps);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Capacités de l'agent" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }}>
        <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
          {keys.map((k, i) => (
            <View key={k} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: i < keys.length - 1 ? 1 : 0, borderBottomColor: "#F0F0F0" }}>
              <Text style={{ flex: 1, color: C.ink, fontSize: 14 }}>{DEFAULTS[k] || label(k)}</Text>
              <Switch value={!!caps[k]} onValueChange={() => toggle(k)} trackColor={{ true: C.lime, false: "#DDD" }} thumbColor={C.white} />
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={save} disabled={busy}
          style={{ height: 52, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: S.md }}>
          {busy ? <ActivityIndicator color={C.ink} /> : <><Ionicons name="save-outline" size={18} color={C.ink} /><Text style={{ color: C.ink, fontWeight: "800" }}>Enregistrer</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function label(k) { return String(k).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
