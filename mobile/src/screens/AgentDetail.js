import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import Avatar from "../components/Avatar";
import { getAgent, patchAgent, setCatalogSource } from "../api";
import AgentEdit from "./AgentEdit";
import AgentCapabilities from "./AgentCapabilities";
import Catalogue from "./Catalogue";
import ConnectWhatsApp from "./ConnectWhatsApp";

const WEB = "https://camille.vps.buyticle.com";

const STATUS = {
  active: { label: "Actif", color: C.green },
  paused: { label: "En pause", color: C.amber },
  draft: { label: "Brouillon", color: C.sub },
  archived: { label: "Archivé", color: C.red },
};

export default function AgentDetail({ agent, onClose, onChanged }) {
  const [full, setFull] = useState(null);
  const [status, setStatus] = useState(agent?.status || "active");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("menu");
  const [catBusy, setCatBusy] = useState(false);

  const back = () => setView("menu");

  useEffect(() => {
    let on = true;
    getAgent(agent.agent_id).then((d) => { const A = d?.agent || d; if (on) { setFull(A); if (A?.status) setStatus(A.status); } }).catch(() => {});
    return () => { on = false; };
  }, [agent.agent_id]);

  // Sous-écrans : APRÈS tous les hooks (sinon violation des règles de hooks -> crash).
  if (view === "edit") return <AgentEdit agent={agent} onClose={back} onSaved={onChanged} />;
  if (view === "capabilities") return <AgentCapabilities agent={agent} onClose={back} />;
  if (view === "catalogue") return <Catalogue agent={agent} onClose={back} />;
  if (view === "connect") return <ConnectWhatsApp agent={agent} onClose={back} />;

  const id = full?.identity || {};
  const bc = full?.business_context || {};
  const caps = full?.capabilities || {};
  const model = full?.system_prompt?.target_model || full?.target_model;
  const st = STATUS[status] || STATUS.active;

  async function toggleStatus() {
    const next = status === "active" ? "paused" : "active";
    setBusy(true);
    try {
      await patchAgent(agent.agent_id, { status: next });
      setStatus(next);
      onChanged && onChanged(agent.agent_id, { status: next });
    } catch (e) {
      Alert.alert("Erreur", e.message || "Impossible de mettre à jour.");
    } finally { setBusy(false); }
  }

  const bigCatalog = full?.catalog_source === "ofs_cj" || full?.catalog_source === "ofs_shop";

  async function toggleCatalog() {
    const next = bigCatalog ? "camille" : "ofs_cj";
    setCatBusy(true);
    try {
      await setCatalogSource(agent.agent_id, next);
      setFull((p) => ({ ...(p || {}), catalog_source: next }));
    } catch (e) {
      Alert.alert("Catalogue", e.message || "Bascule impossible.");
    } finally { setCatBusy(false); }
  }

  const capList = Object.entries(caps).filter(([, v]) => v === true || (typeof v === "string" && v)).map(([k]) => k);

  return (
    <View style={{ flex: 1 }}>
      {/* En-tête */}
      <View style={{ paddingHorizontal: S.md, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={agent.name} size={52} radius={16} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18, letterSpacing: -0.3 }}>{agent.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
            <Text style={{ color: st.color, fontSize: 12, fontWeight: "600" }}>{st.label}</Text>
            <Text style={{ color: C.sub, fontSize: 12 }}>· {bc.business_name || agent.business_name || "Agent"}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line }}>
          <Ionicons name="close" size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Action principale : statut */}
        <TouchableOpacity onPress={toggleStatus} disabled={busy} activeOpacity={0.9}
          style={{ height: 50, borderRadius: R.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
            backgroundColor: status === "active" ? "#FBEBD0" : C.lime, marginBottom: S.md }}>
          {busy ? <ActivityIndicator color={C.ink} /> : (
            <>
              <Ionicons name={status === "active" ? "pause" : "play"} size={16} color={C.ink} />
              <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14 }}>
                {status === "active" ? "Mettre en pause" : "Activer l'agent"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!full && <ActivityIndicator color={C.ink} style={{ marginVertical: 20 }} />}

        <Section title="Identité">
          <Row label="Nom" value={id.name || agent.name} />
          <Row label="Accroche" value={id.tagline} />
          <Row label="Langue" value={id.primary_language} />
          <Row label="Ton" value={id.brand_voice} />
        </Section>

        <Section title="Entreprise">
          <Row label="Boutique" value={bc.business_name} />
          <Row label="Secteur" value={bc.sector} />
          <Row label="Ville" value={bc.location} />
          <Row label="Site web" value={bc.website_url} />
          <Row label="WhatsApp" value={bc.whatsapp_number} />
          <Row label="Description" value={bc.description} multiline />
        </Section>

        <Section title="Configuration">
          <Row label="Modèle IA" value={model} />
          <Row label="Statut" value={st.label} />
        </Section>

        {full?.catalog_source !== undefined && (
          <Section title="Source du catalogue">
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 10 }}>
              <Ionicons name="albums-outline" size={19} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontSize: 14, fontWeight: "600" }}>
                  {bigCatalog ? "Grand catalogue OFS" : "Catalogue natif Camille"}
                </Text>
                <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>
                  {bigCatalog ? "L'agent répond depuis OFS en direct" : "L'agent répond depuis tes produits"}
                </Text>
              </View>
              {catBusy ? <ActivityIndicator color={C.ink} /> : (
                <Switch value={bigCatalog} onValueChange={toggleCatalog}
                  trackColor={{ true: C.lime, false: "#DDD" }} thumbColor={C.white} />
              )}
            </View>
          </Section>
        )}

        {capList.length > 0 && (
          <Section title="Capacités actives">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 }}>
              {capList.map((c) => (
                <View key={c} style={{ backgroundColor: "#EEF6DA", borderRadius: R.pill, paddingHorizontal: 12, height: 30, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 }}>
                  <Ionicons name="checkmark-circle" size={13} color="#5FA300" />
                  <Text style={{ color: "#3F6E00", fontSize: 12, fontWeight: "600" }}>{labelCap(c)}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Management */}
        <Section title="Gestion">
          <Action icon="create-outline" label="Modifier l'agent" onPress={() => setView("edit")} />
          <Action icon="options-outline" label="Capacités" onPress={() => setView("capabilities")} />
          <Action icon="pricetags-outline" label="Catalogue produits" onPress={() => setView("catalogue")} />
          <Action icon="logo-whatsapp" label="Connexion WhatsApp" onPress={() => setView("connect")} />
          <Action icon="stats-chart-outline" label="Statistiques détaillées" onPress={() => Linking.openURL(`${WEB}/dashboard/stats`)} />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>{title.toUpperCase()}</Text>
      <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function Row({ label, value, multiline }) {
  if (value == null || value === "") return null;
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
      flexDirection: multiline ? "column" : "row", alignItems: multiline ? "flex-start" : "center", gap: multiline ? 4 : 10 }}>
      <Text style={{ color: C.sub, fontSize: 13, width: multiline ? undefined : 110 }}>{label}</Text>
      <Text style={{ color: C.ink, fontSize: 13, fontWeight: "600", flex: multiline ? undefined : 1, textAlign: multiline ? "left" : "right" }}>
        {String(value)}
      </Text>
    </View>
  );
}

function Action({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name={icon} size={19} color={C.ink} />
      <Text style={{ flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={C.sub} />
    </TouchableOpacity>
  );
}

function labelCap(k) {
  return String(k).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
