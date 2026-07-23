import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { getPlans, initiatePayment } from "../api";
import { Header } from "./AgentEdit";

function normalize(plansRaw) {
  if (Array.isArray(plansRaw)) return plansRaw;
  if (plansRaw && typeof plansRaw === "object") return Object.entries(plansRaw).map(([id, v]) => ({ id, ...v }));
  return [];
}

export default function Plans({ user, agents = [], onClose }) {
  const [plans, setPlans] = useState(null);
  const [sel, setSel] = useState(null);       // plan choisi pour paiement
  const [agentId, setAgentId] = useState(agents[0]?.agent_id || null);
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);
  const current = String(user?.plan || "free").toLowerCase();

  useEffect(() => {
    getPlans().then((d) => setPlans(normalize(d.plans))).catch(() => setPlans([]));
  }, []);

  async function pay() {
    if (!agentId) { Alert.alert("Aucun agent", "Crée un agent avant de souscrire."); return; }
    if (!phone.trim()) { Alert.alert("Numéro requis", "Entre ton numéro Mobile Money."); return; }
    setBusy(true);
    try {
      const r = await initiatePayment({ agentId, planId: sel.id, phone: phone.trim(), country: "CM" });
      const url = r.payment_url || r.url;
      if (url) { Linking.openURL(url); onClose && onClose(); }
      else Alert.alert("Paiement", "Lien de paiement indisponible, réessaie.");
    } catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  }

  if (!plans) return <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />;

  // Écran paiement
  if (sel) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={`Passer à ${sel.label || sel.id}`} onClose={() => setSel(null)} />
        <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }}>
          <View style={{ backgroundColor: C.ink, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
            <Text style={{ color: C.subDark, fontSize: 12 }}>Montant</Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 26, marginTop: 2 }}>{fmtXAF(sel)}</Text>
            <Text style={{ color: C.lime, fontSize: 12, marginTop: 4 }}>Paiement Mobile Money (Monetbil)</Text>
          </View>

          <Text style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>Agent concerné</Text>
          <View style={{ gap: 8, marginBottom: S.md }}>
            {agents.map((a) => (
              <TouchableOpacity key={a.agent_id} onPress={() => setAgentId(a.agent_id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: agentId === a.agent_id ? C.ink : C.line, padding: 12 }}>
                <Ionicons name={agentId === a.agent_id ? "radio-button-on" : "radio-button-off"} size={18} color={agentId === a.agent_id ? C.ink : C.sub} />
                <Text style={{ color: C.ink, fontSize: 13, flex: 1 }}>{a.name}</Text>
              </TouchableOpacity>
            ))}
            {!agents.length && <Text style={{ color: C.sub, fontSize: 13 }}>Aucun agent disponible.</Text>}
          </View>

          <Text style={{ color: C.sub, fontSize: 12, marginBottom: 6 }}>Numéro Mobile Money</Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, height: 50, marginBottom: S.md }}>
            <Ionicons name="phone-portrait-outline" size={18} color={C.sub} />
            <TextInput value={phone} onChangeText={setPhone} placeholder="Ex: 2376XXXXXXXX" placeholderTextColor={C.sub} keyboardType="phone-pad" style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
          </View>

          <TouchableOpacity onPress={pay} disabled={busy}
            style={{ height: 54, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
            {busy ? <ActivityIndicator color={C.ink} /> : <><Ionicons name="card-outline" size={18} color={C.ink} /><Text style={{ color: C.ink, fontWeight: "800" }}>Payer maintenant</Text></>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Liste des plans
  return (
    <View style={{ flex: 1 }}>
      <Header title="Plans & tarifs" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }}>
        {plans.map((p) => {
          const isCurrent = String(p.id).toLowerCase() === current;
          const paid = (p.price_xaf ?? p.priceXaf ?? 0) > 0;
          return (
            <View key={p.id} style={{ backgroundColor: isCurrent ? C.ink : C.white, borderRadius: R.lg, borderWidth: 1, borderColor: isCurrent ? C.ink : C.line, padding: S.md, marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: isCurrent ? C.white : C.ink, fontWeight: "800", fontSize: 18 }}>{p.label || p.id}</Text>
                {isCurrent && <View style={{ backgroundColor: C.lime, borderRadius: R.pill, paddingHorizontal: 10, height: 22, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.ink, fontWeight: "800", fontSize: 10 }}>ACTUEL</Text></View>}
              </View>
              <Text style={{ color: isCurrent ? C.lime : C.ink, fontWeight: "900", fontSize: 22, marginTop: 6 }}>{fmtXAF(p)}</Text>
              <Text style={{ color: isCurrent ? C.subDark : C.sub, fontSize: 12, marginTop: 4 }}>{limitLabel(p)}</Text>
              {paid && !isCurrent && (
                <TouchableOpacity onPress={() => setSel(p)}
                  style={{ marginTop: 12, height: 44, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }}>Choisir ce plan</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function fmtXAF(p) {
  const x = p.price_xaf ?? p.priceXaf;
  if (x === -1) return "Sur devis";
  if (!x) return "Gratuit";
  return `${Number(x).toLocaleString("fr-FR")} FCFA/mois`;
}
function limitLabel(p) {
  const t = p.monthly_tokens ?? p.limit;
  if (t === -1) return "Tokens illimités";
  if (t != null) return `${Number(t).toLocaleString("fr-FR")} tokens/mois`;
  return "";
}
