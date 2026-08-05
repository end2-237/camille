import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, ActivityIndicator, ScrollView, Animated, Easing,
  KeyboardAvoidingView, Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, SH } from "../theme";
import { Glass, Lueur } from "../components/ui";
import { Press, Reveal } from "../components/motion";
import { login, register } from "../api";

// Ecran de connexion OBLIGATOIRE (aucune donnee tant qu'on n'est pas connecte).
//
// L'inscription se fait ici aussi. Elle renvoyait auparavant vers le site :
// une vendeuse qui n'a qu'un telephone devait trouver un ordinateur pour
// ouvrir son compte, puis revenir. C'etait perdre la moitie des gens entre
// le telechargement et la premiere connexion.

/** Le serveur exige huit caracteres. Le dire avant l'envoi, pas apres. */
const PW_MIN = 8;

export default function Login({ onDone }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [voirPw, setVoirPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const inscription = mode === "register";

  function basculer() {
    setMode(inscription ? "login" : "register");
    setErr("");
    setPw2("");
  }

  /**
   * Valide ce qu'on peut valider sans le serveur.
   *
   * Le serveur repond « Donnees invalides » sans dire lequel des champs pose
   * probleme : autant l'attraper ici, ou on sait quoi montrer.
   */
  function probleme() {
    if (!email.trim()) return "Entre ton email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Cet email ne semble pas valide.";
    if (!pw) return "Entre ton mot de passe.";
    if (!inscription) return "";
    if (pw.length < PW_MIN) return `Le mot de passe doit faire au moins ${PW_MIN} caracteres.`;
    if (pw !== pw2) return "Les deux mots de passe ne sont pas identiques.";
    return "";
  }

  async function submit() {
    const p = probleme();
    if (p) { setErr(p); return; }
    setErr(""); setBusy(true);
    try {
      if (inscription) await register(email.trim(), pw, nom.trim());
      else await login(email.trim(), pw);
      // Le serveur renvoie un jeton des l'inscription : on entre directement,
      // sans redemander le mot de passe qui vient d'etre choisi.
      await onDone();
    } catch (e) {
      setErr(e.message || (inscription ? "Inscription impossible" : "Connexion impossible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Halos de marque derrière le contenu. Un aplat uni sur toute la hauteur
          ferait plat ; ces taches donnent un point de lumière vers lequel l'œil
          monte naturellement. */}
      <Lueur size={360} color="rgba(198,242,78,0.55)" id="lu1" style={{ position: "absolute", top: -130, left: -80 }} />
      <Lueur size={300} color="rgba(140,170,255,0.34)" id="lu2" style={{ position: "absolute", top: 20, right: -110 }} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <Reveal index={0} dy={22} duree={520}>
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View style={[{
              width: 78, height: 78, borderRadius: 26, backgroundColor: C.ink,
              alignItems: "center", justifyContent: "center",
            }, SH.card]}>
              <Text style={{ color: C.lime, fontWeight: "900", fontSize: 38 }}>C</Text>
            </View>
            <Text style={{ fontSize: 30, fontWeight: "800", color: C.ink, marginTop: 20, letterSpacing: -1 }}>
              {inscription ? "Créer ton compte" : "Bon retour"}
            </Text>
            <Text style={{ fontSize: 14.5, color: C.sub, marginTop: 6, textAlign: "center", lineHeight: 20 }}>
              {inscription
                ? "Quelques secondes, et ton premier agent est à toi."
                : "Connecte-toi pour suivre tes agents Camille."}
            </Text>
          </View>
        </Reveal>

        <Reveal index={1} dy={20} duree={520}>
          {inscription && (
            <Field icon="person-outline">
              <TextInput value={nom} onChangeText={setNom} placeholder="Ton nom (facultatif)" placeholderTextColor={C.sub}
                autoCapitalize="words"
                style={{ flex: 1, marginLeft: 11, fontSize: 15, color: C.ink }} />
            </Field>
          )}

          <Field icon="mail-outline">
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.sub}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              style={{ flex: 1, marginLeft: 11, fontSize: 15, color: C.ink }} />
          </Field>

          <Field icon="lock-closed-outline">
            <TextInput value={pw} onChangeText={setPw} placeholder="Mot de passe" placeholderTextColor={C.sub}
              secureTextEntry={!voirPw} autoCapitalize="none"
              style={{ flex: 1, marginLeft: 11, fontSize: 15, color: C.ink }} />
            {/* Voir ce qu'on tape : sur un clavier de telephone, un mot de passe
                masque de huit caracteres se rate une fois sur deux. */}
            <Press onPress={() => setVoirPw((v) => !v)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} scale={0.85}>
              <Ionicons name={voirPw ? "eye-off-outline" : "eye-outline"} size={19} color={C.sub} />
            </Press>
          </Field>

          {inscription && (
            <>
              <Field icon="lock-closed-outline">
                <TextInput value={pw2} onChangeText={setPw2} placeholder="Confirme le mot de passe" placeholderTextColor={C.sub}
                  secureTextEntry={!voirPw} autoCapitalize="none"
                  style={{ flex: 1, marginLeft: 11, fontSize: 15, color: C.ink }} />
              </Field>
              <Text style={{ color: C.sub, fontSize: 11.5, marginTop: -4, marginBottom: 12, marginLeft: 6 }}>
                Au moins {PW_MIN} caractères.
              </Text>
            </>
          )}
        </Reveal>

        <Erreur texte={err} />

        <Reveal index={2} dy={18} duree={520}>
          <Press onPress={submit} disabled={busy} scale={0.97}>
            <View style={[{
              backgroundColor: C.ink, height: 58, borderRadius: R.pill,
              alignItems: "center", justifyContent: "center", marginTop: 6,
            }, SH.card]}>
              {busy
                ? <ActivityIndicator color={C.lime} />
                : <Text style={{ color: C.white, fontWeight: "700", fontSize: 15.5 }}>
                    {inscription ? "Créer mon compte" : "Se connecter"}
                  </Text>}
            </View>
          </Press>

          <Press onPress={basculer} disabled={busy} style={{ marginTop: 24 }} scale={0.98}>
            <Text style={{ color: C.sub, fontSize: 13.5, textAlign: "center" }}>
              {inscription ? "Tu as déjà un compte ? " : "Pas encore de compte ? "}
              <Text style={{ color: C.ink, fontWeight: "700" }}>
                {inscription ? "Se connecter" : "En créer un"}
              </Text>
            </Text>
          </Press>
        </Reveal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, children }) {
  return (
    <Glass
      radius={R.lg}
      shadow={SH.soft}
      style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 58 }}
    >
      <Ionicons name={icon} size={19} color={C.sub} />
      {children}
    </Glass>
  );
}

/**
 * Le message d'erreur arrive en tremblant.
 *
 * Il apparaissait avant d'un seul coup, au milieu d'un formulaire qu'on venait
 * de remplir : on ne le voyait pas. Le petit décalage horizontal attire l'œil
 * là où il faut, une seule fois, sans rien bloquer.
 */
function Erreur({ texte }) {
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!texte) return;
    a.setValue(0);
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(a, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.6, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 70, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  }, [texte, a]);

  if (!texte) return null;

  return (
    <Animated.View style={{
      transform: [{ translateX: a.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }],
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "rgba(248,113,113,0.12)", borderRadius: R.md,
      paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14,
    }}>
      <Ionicons name="alert-circle" size={17} color="#B0322C" />
      <Text style={{ color: "#B0322C", fontSize: 13, flex: 1, lineHeight: 18 }}>{texte}</Text>
    </Animated.View>
  );
}
