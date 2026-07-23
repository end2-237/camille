import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { getAgent, patchAgent } from "../api";

const MODELS = ["moonshotai/kimi-k2-instruct", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

export default function AgentEdit({ agent, onClose, onSaved }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAgent(agent.agent_id).then((d) => {
      const id = d.identity || {}, bc = d.business_context || {};
      setF({
        name: id.name || d.name || "",
        agent_tagline: id.tagline || "",
        primary_language: id.primary_language || "fr",
        brand_voice: id.brand_voice || "",
        business_name: bc.business_name || "",
        sector: bc.sector || "",
        location: bc.location || "",
        website_url: bc.website_url || "",
        whatsapp_number: bc.whatsapp_number || "",
        owner_name: bc.owner_name || "",
        owner_email: bc.owner_email || "",
        target_audience: bc.target_audience || "",
        description: bc.description || d.knowledge_base?.business_description || "",
        target_model: d.system_prompt?.target_model || d.target_model || MODELS[0],
      });
    }).catch((e) => Alert.alert("Erreur", e.message));
  }, [agent.agent_id]);

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  async function save() {
    setBusy(true);
    try {
      await patchAgent(agent.agent_id, f); // l'API filtre les champs autorisés
      onSaved && onSaved(agent.agent_id, { name: f.name, business_name: f.business_name, sector: f.sector });
      Alert.alert("Enregistré", "Les modifications ont été sauvegardées.");
      onClose && onClose();
    } catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  }

  if (!f) return <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Modifier l'agent" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Group title="Identité">
          <Field label="Nom de l'agent" value={f.name} onChangeText={(v) => set("name", v)} />
          <Field label="Accroche" value={f.agent_tagline} onChangeText={(v) => set("agent_tagline", v)} />
          <Field label="Langue" value={f.primary_language} onChangeText={(v) => set("primary_language", v)} />
          <Field label="Ton de marque" value={f.brand_voice} onChangeText={(v) => set("brand_voice", v)} />
        </Group>

        <Group title="Entreprise">
          <Field label="Nom de la boutique" value={f.business_name} onChangeText={(v) => set("business_name", v)} />
          <Field label="Secteur" value={f.sector} onChangeText={(v) => set("sector", v)} />
          <Field label="Ville" value={f.location} onChangeText={(v) => set("location", v)} />
          <Field label="Site web" value={f.website_url} onChangeText={(v) => set("website_url", v)} autoCapitalize="none" />
          <Field label="Numéro WhatsApp" value={f.whatsapp_number} onChangeText={(v) => set("whatsapp_number", v)} keyboardType="phone-pad" />
          <Field label="Propriétaire" value={f.owner_name} onChangeText={(v) => set("owner_name", v)} />
          <Field label="Email propriétaire" value={f.owner_email} onChangeText={(v) => set("owner_email", v)} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Cible" value={f.target_audience} onChangeText={(v) => set("target_audience", v)} />
          <Field label="Description" value={f.description} onChangeText={(v) => set("description", v)} multiline />
        </Group>

        <Group title="Configuration IA">
          <Text style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>Modèle</Text>
          <View style={{ gap: 8 }}>
            {MODELS.map((m) => (
              <TouchableOpacity key={m} onPress={() => set("target_model", m)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: f.target_model === m ? C.ink : C.line, padding: 12 }}>
                <Ionicons name={f.target_model === m ? "radio-button-on" : "radio-button-off"} size={18} color={f.target_model === m ? C.ink : C.sub} />
                <Text style={{ color: C.ink, fontSize: 13, flex: 1 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Group>

        <TouchableOpacity onPress={save} disabled={busy}
          style={{ height: 52, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 6 }}>
          {busy ? <ActivityIndicator color={C.ink} /> : <><Ionicons name="save-outline" size={18} color={C.ink} /><Text style={{ color: C.ink, fontWeight: "800" }}>Enregistrer</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function Header({ title, onClose }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.md, paddingTop: 8, paddingBottom: 10 }}>
      <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18 }}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line }}>
        <Ionicons name="close" size={18} color={C.ink} />
      </TouchableOpacity>
    </View>
  );
}

function Group({ title, children }) {
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8 }}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Field({ label, multiline, ...props }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: C.sub, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={C.sub}
        style={{ backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line,
          paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0, height: multiline ? 84 : 46,
          fontSize: 14, color: C.ink, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}
