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
  template: "classique", lines: "", zebra: true, banner_url: "",
};

// Les mêmes trois modèles que le rendu PDF et que l'aperçu web. Un vendeur ne
// veut pas régler quinze curseurs : il veut choisir une allure.
const MODELES = [
  { id: "classique", nom: "Classique", entete: "plein",    lines: "horizontales", zebra: true },
  { id: "epure",     nom: "Épuré",     entete: "souligne", lines: "aucune",       zebra: false },
  { id: "contraste", nom: "Contrasté", entete: "sombre",   lines: "toutes",       zebra: false },
];

const FILETS = [
  { id: "horizontales", nom: "Lignes horizontales" },
  { id: "toutes",       nom: "Toutes les bordures" },
  { id: "aucune",       nom: "Aucune bordure" },
];

export default function DocSettings({ agent, onClose }) {
  const [f, setF] = useState(null);
  const [geo, setGeo] = useState({ latitude: null, longitude: null });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [bandeauBusy, setBandeauBusy] = useState(false);

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

  // Même flux que le logo, autre destination : le bandeau est large et bas, il
  // se pose avant le pied de page du document.
  async function choisirBandeau() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Autorisation refusée", "Camille a besoin d'accéder à tes photos pour envoyer le bandeau.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;

      setBandeauBusy(true);
      const url = await uploadImage(agent.agent_id, res.assets[0].uri, "bandeau.jpg", "banner");
      set("banner_url", url);
    } catch (e) {
      Alert.alert("Bandeau", e.message || "Envoi impossible");
    } finally {
      setBandeauBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      // Les champs vides ne sont pas enregistrés. Pour l'habillage, une clé
      // absente retombe sur le modèle choisi ; pour l'identité, elle ne retombe
      // sur rien — un champ vide reste vide sur le document, il n'emprunte pas
      // les mentions légales de la plateforme.
      //
      // `?? ""` et non `|| ""` : `zebra: false` est un choix, pas une case
      // vide, et `false || ""` l'aurait effacé silencieusement.
      const doc_settings = Object.fromEntries(
        Object.entries(f).filter(([, v]) => String(v ?? "").trim() !== "")
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

        <Group title="Modèle du tableau">
          <View style={{ gap: 8, marginBottom: 14 }}>
            {MODELES.map((m) => {
              const choisi = (f.template || "classique") === m.id;
              const accent = /^#[0-9a-fA-F]{6}$/.test(String(f.color).trim())
                ? String(f.color).trim() : "#DD5509";
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => { set("template", m.id); set("lines", ""); set("zebra", m.zebra); }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    padding: 10, borderRadius: R.sm,
                    backgroundColor: C.card,
                    borderWidth: choisi ? 2 : 1,
                    borderColor: choisi ? C.text : "transparent",
                  }}
                >
                  {/* Vignette : choisir sur un nom seul revient à choisir au hasard. */}
                  <View style={{ width: 46, borderRadius: 3, overflow: "hidden", backgroundColor: "#FFFFFF" }}>
                    <View style={{
                      height: 7,
                      backgroundColor: m.entete === "sombre" ? "#1F2328" : m.entete === "plein" ? accent : "#FFFFFF",
                      borderBottomWidth: m.entete === "souligne" ? 2 : 0,
                      borderBottomColor: accent,
                    }} />
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={{
                        height: 6,
                        backgroundColor: m.zebra && i % 2 === 1 ? "#FBF6F2" : "#FFFFFF",
                        borderBottomWidth: m.lines !== "aucune" ? 1 : 0,
                        borderBottomColor: "#E6E6E6",
                      }} />
                    ))}
                  </View>
                  <Text style={{ color: C.text, fontSize: 14, flex: 1 }}>{m.nom}</Text>
                  {choisi && <Ionicons name="checkmark-circle" size={18} color={C.text} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ color: C.sub, fontSize: 11, marginBottom: 6 }}>Filets du tableau</Text>
          <View style={{ gap: 6, marginBottom: 14 }}>
            {FILETS.map((ft) => {
              const courant = f.lines
                || (MODELES.find((m) => m.id === (f.template || "classique")) || MODELES[0]).lines;
              const choisi = courant === ft.id;
              return (
                <TouchableOpacity
                  key={ft.id}
                  onPress={() => set("lines", ft.id)}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingVertical: 9, paddingHorizontal: 12,
                    borderRadius: R.sm, backgroundColor: C.card,
                    borderWidth: choisi ? 2 : 1, borderColor: choisi ? C.text : "transparent",
                  }}
                >
                  <Text style={{ color: C.text, fontSize: 13 }}>{ft.nom}</Text>
                  {choisi && <Ionicons name="checkmark" size={16} color={C.text} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => set("zebra", !f.zebra)}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingVertical: 11, paddingHorizontal: 12,
              borderRadius: R.sm, backgroundColor: C.card,
            }}
          >
            <Text style={{ color: C.text, fontSize: 13 }}>
              {f.zebra ? "Une ligne sur deux colorée" : "Fond uni"}
            </Text>
            <Ionicons
              name={f.zebra ? "toggle" : "toggle-outline"}
              size={24}
              color={f.zebra ? C.text : C.sub}
            />
          </TouchableOpacity>
        </Group>

        <Group title="Aperçu">
          <Text style={{ color: C.sub, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            Client et articles fictifs. Ce qui est vide ici le sera aussi sur le
            document envoyé à ton client.
          </Text>
          <BonApercu f={f} />
        </Group>

        <Group title="Bandeau de bas de page">
          <Text style={{ color: C.sub, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            Une image large et peu haute, placée juste avant le pied de page du
            bon. Format conseillé : environ 1000 × 150 pixels.
          </Text>

          {f.banner_url ? (
            <Image
              source={{ uri: f.banner_url }}
              style={{ width: "100%", height: 54, borderRadius: R.sm, backgroundColor: C.card, marginBottom: 10 }}
              resizeMode="contain"
            />
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={choisirBandeau}
              disabled={bandeauBusy}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 10, paddingHorizontal: 14,
                borderRadius: R.sm, backgroundColor: C.card, opacity: bandeauBusy ? 0.6 : 1,
              }}
            >
              {bandeauBusy
                ? <ActivityIndicator size="small" color={C.text} />
                : <Ionicons name="cloud-upload-outline" size={16} color={C.text} />}
              <Text style={{ color: C.text, fontSize: 13 }}>
                {bandeauBusy ? "Envoi…" : f.banner_url ? "Changer" : "Choisir une image"}
              </Text>
            </TouchableOpacity>

            {f.banner_url && !bandeauBusy && (
              <TouchableOpacity onPress={() => set("banner_url", "")} style={{ padding: 8 }}>
                <Ionicons name="trash-outline" size={18} color={C.sub} />
              </TouchableOpacity>
            )}
          </View>
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

/**
 * Aperçu du bon de commande.
 *
 * Reproduit la mise en page du PDF avec des articles fictifs, pour que le
 * vendeur voie ce qu'il règle au lieu de l'imaginer. Mêmes règles de modèle,
 * de filets et d'alternance que le rendu réel : toute différence ici est un
 * défaut d'aperçu, pas un choix.
 */
function BonApercu({ f }) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(f.color).trim()) ? String(f.color).trim() : "#DD5509";
  const mod = MODELES.find((m) => m.id === (f.template || "classique")) || MODELES[0];
  const filets = f.lines || mod.lines;
  const zebre = typeof f.zebra === "boolean" ? f.zebra : mod.zebra;

  const ARTICLES = [
    { d: "Poulet DG", q: 2, p: 4500 },
    { d: "Jus naturel", q: 3, p: 1000 },
    { d: "Livraison", q: 1, p: 1000 },
  ];
  const total = ARTICLES.reduce((s, a) => s + a.q * a.p, 0);
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";

  // Rien n'est inventé : un champ vide reste vide, c'est tout l'intérêt.
  const identite = [
    f.address, f.phone && "Tél : " + f.phone, f.email,
    f.rccm && "RCCM : " + f.rccm, f.niu && "NIU : " + f.niu,
  ].filter(Boolean);
  const pied = [f.name, f.address, f.phone && "Tél : " + f.phone, f.rccm && "RCCM : " + f.rccm]
    .filter(Boolean).join(" · ");

  const cellule = (derniere) => ({
    paddingVertical: 4, paddingHorizontal: 5,
    borderBottomWidth: filets !== "aucune" ? 1 : 0, borderBottomColor: "#E6E6E6",
    borderRightWidth: filets === "toutes" && !derniere ? 1 : 0, borderRightColor: "#E6E6E6",
  });

  const enteteFond =
    mod.entete === "sombre" ? { backgroundColor: "#1F2328" }
    : mod.entete === "souligne" ? { borderBottomWidth: 2, borderBottomColor: accent }
    : { backgroundColor: accent };
  const enteteTexte = mod.entete === "souligne" ? accent : "#FFFFFF";

  return (
    <View style={{ backgroundColor: "#FFFFFF", borderRadius: R.sm, padding: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontWeight: "700", fontSize: 13, color: "#1F2328" }}>
            {f.name || "[ nom de l'entreprise ]"}
          </Text>
          {f.tagline ? <Text style={{ fontSize: 9, fontStyle: "italic", color: "#6B7280" }}>{f.tagline}</Text> : null}
          {identite.map((l, i) => (
            <Text key={i} style={{ fontSize: i >= 2 ? 8 : 9, color: i >= 2 ? "#6B7280" : "#1F2328" }}>{l}</Text>
          ))}
        </View>
        {f.logo_url ? (
          <Image source={{ uri: f.logo_url }} style={{ width: 44, height: 30 }} resizeMode="contain" />
        ) : null}
      </View>

      <View style={{ borderBottomWidth: 3, borderBottomColor: accent, marginVertical: 8 }} />
      <Text style={{ fontWeight: "700", fontSize: 16, color: accent, marginBottom: 8 }}>BON DE COMMANDE</Text>

      <View style={{ flexDirection: "row", ...enteteFond }}>
        <Text style={{ flex: 4, fontSize: 8, fontWeight: "700", color: enteteTexte, padding: 5 }}>DÉSIGNATION</Text>
        <Text style={{ flex: 1, fontSize: 8, fontWeight: "700", color: enteteTexte, padding: 5, textAlign: "center" }}>QTÉ</Text>
        <Text style={{ flex: 2, fontSize: 8, fontWeight: "700", color: enteteTexte, padding: 5, textAlign: "right" }}>MONTANT</Text>
      </View>
      {ARTICLES.map((a, i) => (
        <View key={i} style={{ flexDirection: "row", backgroundColor: zebre && i % 2 === 1 ? "#FBF6F2" : "#FFFFFF" }}>
          <Text style={{ flex: 4, fontSize: 9, color: "#1F2328", ...cellule(false) }}>{a.d}</Text>
          <Text style={{ flex: 1, fontSize: 9, color: "#1F2328", textAlign: "center", ...cellule(false) }}>{a.q}</Text>
          <Text style={{ flex: 2, fontSize: 9, color: "#1F2328", textAlign: "right", ...cellule(true) }}>{fmt(a.q * a.p)}</Text>
        </View>
      ))}

      <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: accent, padding: 6, marginTop: 4 }}>
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 10 }}>TOTAL NET À PAYER</Text>
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 10 }}>{fmt(total)}</Text>
      </View>

      {f.banner_url ? (
        <Image source={{ uri: f.banner_url }} style={{ width: "100%", height: 34, marginTop: 8 }} resizeMode="contain" />
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: "#E6E6E6", marginTop: 10, paddingTop: 4 }}>
        <Text style={{ fontSize: 7, color: "#6B7280", textAlign: "center" }}>{pied || " "}</Text>
      </View>
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
