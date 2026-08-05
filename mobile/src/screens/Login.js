import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R } from "../theme";
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
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <View style={{ width: 74, height: 74, borderRadius: 22, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.lime, fontWeight: "900", fontSize: 38 }}>C</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: "800", color: C.ink, marginTop: 16, letterSpacing: -0.5 }}>
            {inscription ? "Créer ton compte" : "Bienvenue"}
          </Text>
          <Text style={{ fontSize: 14, color: C.sub, marginTop: 4, textAlign: "center" }}>
            {inscription
              ? "Quelques secondes, et ton premier agent est à toi."
              : "Connecte-toi pour suivre tes agents Camille."}
          </Text>
        </View>

        {inscription && (
          <Field icon="person-outline">
            <TextInput value={nom} onChangeText={setNom} placeholder="Ton nom (facultatif)" placeholderTextColor={C.sub}
              autoCapitalize="words"
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
          </Field>
        )}

        <Field icon="mail-outline">
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.sub}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
        </Field>

        <Field icon="lock-closed-outline">
          <TextInput value={pw} onChangeText={setPw} placeholder="Mot de passe" placeholderTextColor={C.sub}
            secureTextEntry={!voirPw} autoCapitalize="none"
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
          {/* Voir ce qu'on tape : sur un clavier de telephone, un mot de passe
              masque de huit caracteres se rate une fois sur deux. */}
          <TouchableOpacity onPress={() => setVoirPw((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={voirPw ? "eye-off-outline" : "eye-outline"} size={18} color={C.sub} />
          </TouchableOpacity>
        </Field>

        {inscription && (
          <>
            <Field icon="lock-closed-outline">
              <TextInput value={pw2} onChangeText={setPw2} placeholder="Confirme le mot de passe" placeholderTextColor={C.sub}
                secureTextEntry={!voirPw} autoCapitalize="none"
                style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
            </Field>
            <Text style={{ color: C.sub, fontSize: 11.5, marginTop: -6, marginBottom: 10, marginLeft: 4 }}>
              Au moins {PW_MIN} caractères.
            </Text>
          </>
        )}

        {err ? <Text style={{ color: C.red, marginBottom: 12, fontSize: 13, textAlign: "center" }}>{err}</Text> : null}

        <TouchableOpacity onPress={submit} disabled={busy}
          style={{ backgroundColor: C.ink, height: 56, borderRadius: R.pill, alignItems: "center", justifyContent: "center", marginTop: 4, opacity: busy ? 0.7 : 1 }}>
          {busy
            ? <ActivityIndicator color={C.lime} />
            : <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>
                {inscription ? "Créer mon compte" : "Se connecter"}
              </Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={basculer} disabled={busy} style={{ marginTop: 22 }}>
          <Text style={{ color: C.sub, fontSize: 13, textAlign: "center" }}>
            {inscription ? "Tu as déjà un compte ? " : "Pas encore de compte ? "}
            <Text style={{ color: C.ink, fontWeight: "700" }}>
              {inscription ? "Se connecter" : "En créer un"}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, children }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: R.md, marginBottom: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 54, borderWidth: 1, borderColor: C.line }}>
      <Ionicons name={icon} size={18} color={C.sub} />
      {children}
    </View>
  );
}
