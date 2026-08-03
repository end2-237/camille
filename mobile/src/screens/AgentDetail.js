import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, Switch, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import Avatar from "../components/Avatar";
import { getAgent, patchAgent, setCatalogSource, uploadImage } from "../api";
import * as ImagePicker from "expo-image-picker";
import AgentEdit from "./AgentEdit";
import AgentCapabilities from "./AgentCapabilities";
import Catalogue from "./Catalogue";
import ConnectWhatsApp from "./ConnectWhatsApp";
import Orders from "./Orders";

const WEB = "https://camille.vps.buyticle.com";

const STATUS = {
  active: { label: "Actif", color: C.green },
  paused: { label: "En pause", color: C.amber },
  draft: { label: "Brouillon", color: C.sub },
  archived: { label: "Archivé", color: C.red },
};

// initialView : ouvre directement une sous-vue au lieu du menu. Sert a
// l'aiguillage des notifications — une alerte « agent deconnecte » doit tomber
// sur l'ecran de connexion WhatsApp, pas sur un menu ou il faut la rechercher.
export default function AgentDetail({ agent, onClose, onChanged, initialView }) {
  const [full, setFull] = useState(null);
  const [status, setStatus] = useState(agent?.status || "active");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(initialView || "menu");
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
  if (view === "orders") return <Orders agent={agent} onClose={back} />;

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

  const convMode = full?.conversion_mode || "whatsapp";

  // La carte du menu n'a de sens qu'en restauration : ailleurs, on ne
  // propose meme pas le reglage.
  const isResto = /resto|restaurant|food|cuisine|snack|fast|pizz|traiteur|patisser|boulanger|glacier/i
    .test(String(full?.business_context?.sector || full?.sector || agent?.sector || ""));

  async function setConv(mode) {
    setCatBusy(true);
    try {
      await patchAgent(agent.agent_id, { conversion_mode: mode });
      setFull((p) => ({ ...(p || {}), conversion_mode: mode }));
    } catch (e) { Alert.alert("Mode de conversion", e.message); }
    finally { setCatBusy(false); }
  }

  // Upload de la carte depuis la galerie du telephone.
  async function pickMenu() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Autorisation refusée", "Camille a besoin d'accéder à tes photos pour envoyer la carte.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;

      setCatBusy(true);
      const url = await uploadImage(agent.agent_id, res.assets[0].uri, "carte-menu.jpg");
      await patchAgent(agent.agent_id, { menu_image_url: url });
      setFull((p) => ({ ...(p || {}), menu_image_url: url }));
      Alert.alert("Carte enregistrée", "Elle sera envoyée au client quand il demandera le menu 📋");
    } catch (e) {
      Alert.alert("Carte du menu", e.message || "Envoi impossible");
    } finally { setCatBusy(false); }
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

        {/* Raccourcis : les actions les plus utilisées restent visibles sans scroller. */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: S.md }}>
          <Quick icon="receipt-outline" label="Commandes" highlight onPress={() => setView("orders")} />
          <Quick icon="pricetags-outline" label="Catalogue" onPress={() => setView("catalogue")} />
          <Quick icon="logo-whatsapp" label="WhatsApp" onPress={() => setView("connect")} />
        </View>

        <Section title="Mode de conversion">
          {[
            { id: "whatsapp", t: "Conclure dans WhatsApp", d: "Panier + commande enregistrée, vous êtes notifié" },
            { id: "boutique", t: "Renvoyer vers ma boutique", d: "Le lien produit reste l'action principale" },
          ].map((o, i) => {
            const on = convMode === o.id;
            return (
              <TouchableOpacity key={o.id} onPress={() => setConv(o.id)} disabled={catBusy}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13,
                  borderBottomWidth: i === 0 ? 1 : 0, borderBottomColor: "#F0F0F0" }}>
                <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={19} color={on ? C.green : C.sub} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontSize: 14, fontWeight: on ? "700" : "600" }}>{o.t}</Text>
                  <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>{o.d}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </Section>

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

        <Section title="Utilisation & limites">
          <Row label="Messages reçus" value={fmt(agent.messages_received)} />
          <Row label="Messages traités" value={fmt(agent.period_messages ?? agent.messages)} />
          <Row label="Leads" value={fmt(agent.period_leads)} />
          <Row label="Escalades" value={fmt(agent.period_escalations)} />
          <Row label="Tokens (mois)" value={
            agent.token_unlimited
              ? `${fmt(agent.token_used_month)} · illimité`
              : `${fmt(agent.token_used_month)}${agent.token_limit ? ` / ${fmt(agent.token_limit)}` : ""}`
          } />
          {!agent.token_unlimited && !!agent.token_limit && (
            <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: "#EEE", overflow: "hidden" }}>
                <View style={{ width: `${Math.min(100, Number(agent.token_percent) || 0)}%`, height: 7, borderRadius: 4,
                  backgroundColor: (agent.token_percent || 0) >= 90 ? C.red : (agent.token_percent || 0) >= 70 ? C.amber : C.green }} />
              </View>
              <Text style={{ color: C.sub, fontSize: 11, marginTop: 6 }}>{agent.token_percent || 0}% du quota utilisé</Text>
            </View>
          )}
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

        <Section title="Livraison">
          <Row label="Frais par défaut" value={`${Number(full?.delivery_fee ?? 1000).toLocaleString("fr-FR")} XAF`} />
          <Row label="Quartiers tarifés" value={`${(full?.delivery_zones || []).length} zone(s)`} />
          <Action icon="pricetag-outline" label="Modifier les frais"
            onPress={() => Linking.openURL(`${WEB}/dashboard/${agent.agent_id}/settings`)} />
        </Section>

        {isResto && (
          <Section title="Carte du menu">
            {full?.menu_image_url ? (
              <View style={{ padding: 12 }}>
                <Image source={{ uri: full.menu_image_url }}
                  style={{ width: "100%", height: 170, borderRadius: 10, backgroundColor: "#F2F2F2" }}
                  resizeMode="cover" />
                <Text style={{ color: C.sub, fontSize: 11.5, marginTop: 8 }}>
                  Envoyée au client quand il demande le menu, juste après les premiers plats.
                </Text>
              </View>
            ) : (
              <View style={{ padding: 12 }}>
                <Text style={{ color: C.sub, fontSize: 12.5 }}>
                  Aucune carte enregistrée. Ajoute-la pour que Camille l&apos;envoie automatiquement
                  quand un client demande le menu.
                </Text>
              </View>
            )}
            <Action icon="image-outline" label={full?.menu_image_url ? "Remplacer la carte" : "Ajouter la carte"}
              onPress={pickMenu} />
          </Section>
        )}

        <Section title="Gestion">
          <Action icon="receipt-outline" label="Commandes" onPress={() => setView("orders")} />
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

function Quick({ icon, label, onPress, highlight }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14,
        borderRadius: R.lg, backgroundColor: highlight ? C.ink : C.white,
        borderWidth: 1, borderColor: highlight ? C.ink : C.line }}>
      <Ionicons name={icon} size={20} color={highlight ? C.lime : C.ink} />
      <Text style={{ fontSize: 11.5, fontWeight: "700", color: highlight ? C.white : C.ink }}>{label}</Text>
    </TouchableOpacity>
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

function fmt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("fr-FR") : "0";
}

function labelCap(k) {
  return String(k).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
