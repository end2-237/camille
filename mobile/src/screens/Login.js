import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { login } from "../api";

// Ecran de connexion OBLIGATOIRE (aucune donnee tant qu'on n'est pas connecte).
export default function Login({ onDone }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!email.trim() || !pw) { setErr("Entre ton email et ton mot de passe."); return; }
    setErr(""); setBusy(true);
    try {
      await login(email.trim(), pw);
      await onDone();
    } catch (e) {
      setErr(e.message || "Connexion impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 34 }}>
          <View style={{ width: 74, height: 74, borderRadius: 22, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.lime, fontWeight: "900", fontSize: 38 }}>C</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: "800", color: C.ink, marginTop: 16, letterSpacing: -0.5 }}>Bienvenue</Text>
          <Text style={{ fontSize: 14, color: C.sub, marginTop: 4, textAlign: "center" }}>
            Connecte-toi pour suivre tes agents Camille.
          </Text>
        </View>

        <Field icon="mail-outline">
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.sub}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
        </Field>
        <Field icon="lock-closed-outline">
          <TextInput value={pw} onChangeText={setPw} placeholder="Mot de passe" placeholderTextColor={C.sub}
            secureTextEntry style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
        </Field>

        {err ? <Text style={{ color: C.red, marginBottom: 12, fontSize: 13, textAlign: "center" }}>{err}</Text> : null}

        <TouchableOpacity onPress={submit} disabled={busy}
          style={{ backgroundColor: C.ink, height: 56, borderRadius: R.pill, alignItems: "center", justifyContent: "center", marginTop: 4, opacity: busy ? 0.7 : 1 }}>
          {busy ? <ActivityIndicator color={C.lime} /> : <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Se connecter</Text>}
        </TouchableOpacity>

        <Text style={{ color: C.sub, fontSize: 12, textAlign: "center", marginTop: 22 }}>
          Pas encore de compte ? Crée-le sur camille.vps.buyticle.com
        </Text>
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
