import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { createAgent } from "../api";
import { Header } from "./AgentEdit";

const SECTORS = [
  { id: "ecommerce", label: "E-commerce" },
  { id: "food_beverage", label: "Restauration" },
  { id: "beauty_wellness", label: "Beauté & Bien-être" },
  { id: "consulting", label: "Services / Conseil" },
  { id: "tech_saas", label: "Tech / Électronique" },
  { id: "other", label: "Autre" },
];

const TONES = [
  { id: "friendly", label: "Chaleureux" },
  { id: "professional", label: "Professionnel" },
  { id: "casual", label: "Décontracté" },
];

export default function AgentCreate({ onClose, onCreated }) {
  const [f, setF] = useState({
    agent_name: "",
    business_name: "",
    sector: "ecommerce",
    description: "",
    location: "",
    whatsapp_number: "",
    brand_voice: "friendly",
    primary_language: "fr",
  });
  const [busy, setBusy] = useState(false);

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  function buildPrompt() {
    const secLabel = (SECTORS.find((s) => s.id === f.sector) || {}).label || "";
    return [
      `Tu es ${f.agent_name || "l'assistant"}, le vendeur de ${f.business_name || "la boutique"}.`,
      secLabel ? `Secteur : ${secLabel}.` : "",
      f.location ? `Ville : ${f.location}.` : "",
      f.description ? `À propos : ${f.description}` : "",
      "Réponds de façon chaleureuse et humaine, en français, avec des messages courts adaptés à WhatsApp.",
    ].filter(Boolean).join("\n");
  }

  async function submit() {
    if (!f.agent_name.trim()) { Alert.alert("Nom requis", "Donne un nom à ton agent."); return; }
    if (!f.business_name.trim()) { Alert.alert("Boutique requise", "Indique le nom de ta boutique."); return; }
    setBusy(true);
    try {
      const d = await createAgent({ ...f, agent_name: f.agent_name.trim(), business_name: f.business_name.trim() }, buildPrompt());
      Alert.alert("Agent créé 🎉", "Ton agent est créé en brouillon. Connecte WhatsApp pour l'activer.");
      onCreated && (await onCreated(d.agent));
      onClose && onClose();
    } catch (e) {
      Alert.alert("Erreur", e.message || "Création impossible");
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title="Nouvel agent" onClose={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="Nom de l'agent *" value={f.agent_name} onChangeText={(v) => set("agent_name", v)} placeholder="Ex : Clara" />
          <Field label="Nom de la boutique *" value={f.business_name} onChangeText={(v) => set("business_name", v)} placeholder="Ex : OneFreeStyle" />

          <Label>Secteur</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {SECTORS.map((s) => (
              <TouchableOpacity key={s.id} onPress={() => set("sector", s.id)}
                style={{ paddingHorizontal: 14, height: 36, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
                  backgroundColor: f.sector === s.id ? C.ink : C.white, borderWidth: 1, borderColor: f.sector === s.id ? C.ink : C.line }}>
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: f.sector === s.id ? C.white : C.ink }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Label>Ton de l'agent</Label>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {TONES.map((t) => (
              <TouchableOpacity key={t.id} onPress={() => set("brand_voice", t.id)}
                style={{ flex: 1, height: 40, borderRadius: R.md, alignItems: "center", justifyContent: "center",
                  backgroundColor: f.brand_voice === t.id ? C.lime : C.white, borderWidth: 1, borderColor: f.brand_voice === t.id ? C.lime : C.line }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.ink }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Ville" value={f.location} onChangeText={(v) => set("location", v)} placeholder="Ex : Douala" />
          <Field label="Numéro WhatsApp" value={f.whatsapp_number} onChangeText={(v) => set("whatsapp_number", v)} placeholder="Ex : 2376XXXXXXXX" keyboardType="phone-pad" />
          <Field label="Que vends-tu ?" value={f.description} onChangeText={(v) => set("description", v)} placeholder="Décris ton activité en une phrase" multiline />

          <TouchableOpacity onPress={submit} disabled={busy}
            style={{ height: 54, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 6 }}>
            {busy ? <ActivityIndicator color={C.ink} /> : (
              <>
                <Ionicons name="add-circle-outline" size={19} color={C.ink} />
                <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15 }}>Créer l'agent</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{ color: C.sub, fontSize: 11.5, textAlign: "center", marginTop: 14, lineHeight: 17 }}>
            L&apos;agent est créé en brouillon. Tu pourras ensuite connecter WhatsApp et ajuster ses capacités.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Label({ children }) {
  return <Text style={{ color: C.sub, fontSize: 11, marginBottom: 6 }}>{children}</Text>;
}

function Field({ label, multiline, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={C.sub}
        style={{ backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line,
          paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0, height: multiline ? 84 : 48,
          fontSize: 14, color: C.ink, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}
