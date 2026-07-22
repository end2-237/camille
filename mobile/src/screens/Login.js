import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { login } from "../api";

export default function Login({ onDone }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr(""); setBusy(true);
    try {
      await login(email.trim(), pw);
      onDone();
    } catch (e) {
      setErr(e.message || "Connexion impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.lime, fontWeight: "900", fontSize: 18 }}>C</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: "800", color: C.ink }}>Camille</Text>
        </View>
        <Text style={{ color: C.sub, fontSize: 14, marginBottom: 28 }}>Suivi de vos agents IA</Text>

        <View style={{ backgroundColor: C.white, borderRadius: R.md, marginBottom: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 52 }}>
          <Ionicons name="mail-outline" size={18} color={C.sub} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.sub}
            autoCapitalize="none" keyboardType="email-address"
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
        </View>
        <View style={{ backgroundColor: C.white, borderRadius: R.md, marginBottom: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 52 }}>
          <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
          <TextInput value={pw} onChangeText={setPw} placeholder="Mot de passe" placeholderTextColor={C.sub}
            secureTextEntry style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
        </View>

        {err ? <Text style={{ color: C.red, marginBottom: 12, fontSize: 13 }}>{err}</Text> : null}

        <TouchableOpacity onPress={submit} disabled={busy}
          style={{ backgroundColor: C.ink, height: 54, borderRadius: R.pill, alignItems: "center", justifyContent: "center" }}>
          {busy ? <ActivityIndicator color={C.lime} /> :
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Se connecter</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onDone} style={{ alignItems: "center", marginTop: 18 }}>
          <Text style={{ color: C.sub, fontSize: 13 }}>Voir la démo sans connexion</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
