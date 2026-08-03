// ─────────────────────────────────────────────────────────────────────────────
// Personnalisation du bon de commande.
//
// Le document partait au nom d'une seule entreprise pour tout le monde : chaque
// vendeur envoyait à SES clients un bon portant le nom et le RCCM d'un tiers.
// Cet écran lui rend son identité.
//
// La position du local est ici plutôt que dans la création de l'agent : c'est
// l'adresse du document, et c'est aussi ce que l'agent envoie au client qui
// demande où se trouve la boutique.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { C, R, S } from "../theme";
import { getAgent, patchAgent, uploadImage } from "../api";
import { Header } from "./AgentEdit";

// Teintes proposées. Le vendeur peut saisir n'importe quel code hexadécimal :
// ces pastilles ne sont qu'un raccourci pour ceux qui n'en ont pas en tête.
const TEINTES = ["#DD5509", "#101012", "#1D4ED8", "#047857", "#B91C1C", "#7C3AED"];

const CHAMPS_VIDES = {
  name: "", tagline: "", address: "", phone: "",
  email: "", rccm: "", niu: "", logo_url: "", color: "",
};

export default function DocSettings({ agent, onClose }) {
  const [f, setF] = useState(null);
  const [geo, setGeo] = useState({ latitude: null, longitude: null });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    getAgent(agent.agent_id)
      .then((r) => {
        const d = r?.agent || r;
        const bc = d.business_context || {};
        const ds = d.doc_settings || {};
        // Préremplissage : ce que le vendeur a déjà renseigné pour son agent
        // vaut mieux qu'un formulaire vide qu'il faut ressaisir.
        setF({
          ...CHAMPS_VIDES,
          ...ds,
          name: ds.name || bc.business_name || "",
          address: ds.address || bc.location || "",
          phone: ds.phone || bc.whatsapp_number || "",
          email: ds.email || bc.owner_email || "",
        });
        setGeo({
          latitude: d.latitude ?? null,
          longitude: d.longitude ?? null,
        });
      })
      .catch((e) => Alert.alert("Erreur", e.message));
  }, [agent.agent_id]);

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  async function detecterPosition() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Autorisation refusée",
          "Sans accès à la position, tu peux toujours saisir l'adresse à la main."
        );
        return;
      }
      // Haute précision : on relève une devanture, pas une ville.
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setGeo({
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
      });
      // L'adresse lisible complète le relevé sans le remplacer : les
      // coordonnées restent ce qui guide le client jusqu'à la porte.
      try {
        const [lieu] = await Location.reverseGeocodeAsync(pos.coords);
        if (lieu && !f.address) {
          const libelle = [lieu.street, lieu.district, lieu.city, lieu.country]
            .filter(Boolean).join(", ");
          if (libelle) set("address", libelle);
        }
      } catch { /* le relevé seul suffit */ }
    } catch (e) {
      Alert.alert("Position introuvable", e.message);
    } finally {
      setLocating(false);
    }
  }

  // Le logo se choisit dans la galerie. Demander une URL supposait que le
  // vendeur héberge son image quelque part — ce que personne ne fait depuis un
  // téléphone.
  async function choisirLogo() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Autorisation refusée", "Camille a besoin d'accéder à tes photos pour envoyer le logo.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;

      setLogoBusy(true);
      const url = await uploadImage(agent.agent_id, res.assets[0].uri, "logo.jpg", "logo");
      // Posé dans le formulaire seulement : c'est « Enregistrer » qui valide,
      // comme pour tous les autres champs de l'écran.
      set("logo_url", url);
    } catch (e) {
      Alert.alert("Logo", e.message || "Envoi impossible");
    } finally {
      setLogoBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      // Les champs vides ne sont pas enregistrés : côté document, l'absence
      // d'une clé retombe proprement sur une valeur par défaut là où une chaîne
      // vide laisserait un trou dans l'en-tête.
      const doc_settings = Object.fromEntries(
        Object.entries(f).filter(([, v]) => String(v || "").trim() !== "")
      );
      await patchAgent(agent.agent_id, {
        doc_settings,
        ...(geo.latitude != null && geo.longitude != null
          ? { latitude: geo.latitude, longitude: geo.longitude }
          : {}),
      });
      Alert.alert("Enregistré", "Tes prochains bons de commande porteront ces informations.");
      onClose && onClose();
    } catch (e) {
      Alert.alert("Erreur", e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!f) return <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />;

  const positionConnue = geo.latitude != null && geo.longitude != null;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Mon bon de commande" onClose={onClose} />
      <ScrollView
        contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: C.sub, fontSize: 12, lineHeight: 17, marginBottom: S.md }}>
          Ces informations s'impriment en haut et en bas de chaque bon de
          commande envoyé à tes clients. Les champs laissés vides sont
          simplement omis.
        </Text>

        <Group title="Entreprise">
          <Field label="Nom de l'entreprise" value={f.name} onChangeText={(v) => set("name", v)}
            placeholder="Ex. Chez Mama Ngo" />
          <Field label="Accroche (facultatif)" value={f.tagline} onChangeText={(v) => set("tagline", v)}
            placeholder="Ex. Restaurant traditionnel" />
          <Field label="Adresse" value={f.address} onChangeText={(v) => set("address", v)}
            placeholder="Ex. Bonamoussadi, Douala" />
          <Field label="Téléphone" value={f.phone} onChangeText={(v) => set("phone", v)}
            keyboardType="phone-pad" placeholder="Ex. (+237) 6 99 00 00 00" />
          <Field label="Courriel (facultatif)" value={f.email} onChangeText={(v) => set("email", v)}
            keyboardType="email-address" autoCapitalize="none" />
        </Group>

        <Group title="Mentions légales">
          <Field label="RCCM (facultatif)" value={f.rccm} onChangeText={(v) => set("rccm", v)}
            autoCapitalize="characters" />
          <Field label="NIU (facultatif)" value={f.niu} onChangeText={(v) => set("niu", v)}
            autoCapitalize="characters" />
        </Group>

        <Group title="Apparence">
          <Text style={{ color: C.sub, fontSize: 11, marginBottom: 6 }}>Logo (facultatif)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {f.logo_url ? (
              <Image
                source={{ uri: f.logo_url }}
                style={{ width: 56, height: 56, borderRadius: R.sm, backgroundColor: C.card }}
                resizeMode="contain"
              />
            ) : (
              <View style={{
                width: 56, height: 56, borderRadius: R.sm, backgroundColor: C.card,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="image-outline" size={22} color={C.sub} />
              </View>
            )}

            <TouchableOpacity
              onPress={choisirLogo}
              disabled={logoBusy}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 10, paddingHorizontal: 14,
                borderRadius: R.sm, backgroundColor: C.card, opacity: logoBusy ? 0.6 : 1,
              }}
            >
              {logoBusy
                ? <ActivityIndicator size="small" color={C.text} />
                : <Ionicons name="cloud-upload-outline" size={16} color={C.text} />}
              <Text style={{ color: C.text, fontSize: 13 }}>
                {logoBusy ? "Envoi…" : f.logo_url ? "Changer" : "Choisir une image"}
              </Text>
            </TouchableOpacity>

            {f.logo_url && !logoBusy && (
              <TouchableOpacity onPress={() => set("logo_url", "")} style={{ padding: 8 }}>
                <Ionicons name="trash-outline" size={18} color={C.sub} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ color: C.sub, fontSize: 11, marginBottom: 6 }}>Couleur du document</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            {TEINTES.map((t) => {
              const choisie = String(f.color).toLowerCase() === t.toLowerCase();
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => set("color", choisie ? "" : t)}
                  style={{
                    width: 38, height: 38, borderRadius: 19, backgroundColor: t,
                    borderWidth: choisie ? 3 : 1,
                    borderColor: choisie ? C.ink : C.line,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {choisie && <Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
          <Field label="Ou un code précis (facultatif)" value={f.color}
            onChangeText={(v) => set("color", v)} autoCapitalize="none" placeholder="#DD5509" />
        </Group>

        <Group title="Position du local">
          <Text style={{ color: C.sub, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            Relève la position depuis ta boutique : c'est elle que ton agent
            enverra aux clients qui demandent où te trouver.
          </Text>

          <TouchableOpacity
            onPress={detecterPosition}
            disabled={locating}
            style={{
              height: 48, borderRadius: R.md, backgroundColor: C.white,
              borderWidth: 1, borderColor: C.line, flexDirection: "row",
              alignItems: "center", justifyContent: "center", gap: 8,
              opacity: locating ? 0.6 : 1, marginBottom: 10,
            }}
          >
            {locating
              ? <ActivityIndicator color={C.ink} />
              : <Ionicons name="locate-outline" size={18} color={C.ink} />}
            <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>
              {locating ? "Relevé en cours…" : "Je suis dans ma boutique"}
            </Text>
          </TouchableOpacity>

          <View style={{
            padding: 12, borderRadius: R.md,
            backgroundColor: positionConnue ? "#EDF7EE" : C.white,
            borderWidth: 1, borderColor: positionConnue ? "#C6E7C9" : C.line,
            flexDirection: "row", alignItems: "center", gap: 8,
          }}>
            <Ionicons
              name={positionConnue ? "checkmark-circle" : "help-circle-outline"}
              size={17}
              color={positionConnue ? "#1E7B32" : C.sub}
            />
            <Text style={{ color: positionConnue ? "#1E7B32" : C.sub, fontSize: 12, flex: 1 }}>
              {positionConnue
                ? `Position enregistrée · ${geo.latitude}, ${geo.longitude}`
                : "Aucune position enregistrée pour le moment."}
            </Text>
          </View>
        </Group>

        <TouchableOpacity
          onPress={save}
          disabled={busy}
          style={{
            height: 52, borderRadius: R.pill, backgroundColor: C.lime,
            alignItems: "center", justifyContent: "center",
            flexDirection: "row", gap: 8, opacity: busy ? 0.6 : 1, marginTop: 4,
          }}
        >
          {busy
            ? <ActivityIndicator color={C.ink} />
            : <Ionicons name="save-outline" size={18} color={C.ink} />}
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15 }}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }) {
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8 }}>
        {title.toUpperCase()}
      </Text>
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
        style={{
          backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line,
          paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0,
          height: multiline ? 84 : 46, fontSize: 14, color: C.ink,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
