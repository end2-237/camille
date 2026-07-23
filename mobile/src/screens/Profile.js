import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { login, logout } from "../api";

export default function Profile({ user, setUser, onAuthChange }) {
  if (user) return <Account user={user} setUser={setUser} onAuthChange={onAuthChange} />;
  return <LoginForm onAuthChange={onAuthChange} />;
}

function Account({ user, setUser, onAuthChange }) {
  const [busy, setBusy] = useState(false);
  const name = user.full_name || user.email || "Utilisateur";
  const initials = (name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("") || "U").toUpperCase();

  async function doLogout() {
    setBusy(true);
    await logout();
    setUser(null);
    await onAuthChange();
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 }}>
      <View style={{ alignItems: "center", marginTop: 20, marginBottom: 24 }}>
        <View style={{ width: 84, height: 84, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.lime, fontWeight: "800", fontSize: 30 }}>{initials}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink, marginTop: 14 }}>{name}</Text>
        <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{user.email}</Text>
      </View>

      <View style={{ backgroundColor: C.white, borderRadius: R.lg, padding: 4, marginBottom: S.md, borderWidth: 1, borderColor: C.line }}>
        <Row icon="pricetag-outline" label="Plan" value={String(user.plan || "free").toUpperCase()} />
        <Divider />
        <Row icon="id-card-outline" label="Compte" value={`#${String(user.id || "").slice(0, 8)}`} />
      </View>

      <TouchableOpacity onPress={doLogout} disabled={busy}
        style={{ height: 52, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
        {busy ? <ActivityIndicator color={C.ink} /> : (
          <>
            <Ionicons name="log-out-outline" size={18} color={C.red} />
            <Text style={{ color: C.red, fontWeight: "700", fontSize: 15 }}>Se déconnecter</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 20 }}>Camille · v1.0.0</Text>
    </ScrollView>
  );
}

function LoginForm({ onAuthChange }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr(""); setBusy(true);
    try {
      await login(email.trim(), pw);
      await onAuthChange();
    } catch (e) {
      setErr(e.message || "Connexion impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92, paddingTop: 30 }}>
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.lime, fontWeight: "900", fontSize: 32 }}>C</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink, marginTop: 14 }}>Connexion</Text>
          <Text style={{ fontSize: 13, color: C.sub, marginTop: 4, textAlign: "center" }}>
            Connecte-toi pour voir tes vrais agents et statistiques.
          </Text>
        </View>

        <Field icon="mail-outline">
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.sub}
            autoCapitalize="none" keyboardType="email-address" style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
        </Field>
        <Field icon="lock-closed-outline">
          <TextInput value={pw} onChangeText={setPw} placeholder="Mot de passe" placeholderTextColor={C.sub}
            secureTextEntry style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
        </Field>

        {err ? <Text style={{ color: C.red, marginBottom: 12, fontSize: 13 }}>{err}</Text> : null}

        <TouchableOpacity onPress={submit} disabled={busy}
          style={{ backgroundColor: C.ink, height: 54, borderRadius: R.pill, alignItems: "center", justifyContent: "center" }}>
          {busy ? <ActivityIndicator color={C.lime} /> : <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Se connecter</Text>}
        </TouchableOpacity>

        <Text style={{ color: C.sub, fontSize: 12, textAlign: "center", marginTop: 18 }}>
          Sans connexion, l'app affiche des données de démonstration.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, children }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: R.md, marginBottom: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: C.line }}>
      <Ionicons name={icon} size={18} color={C.sub} />
      {children}
    </View>
  );
}

function Row({ icon, label, value }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, gap: 10 }}>
      <Ionicons name={icon} size={18} color={C.ink} />
      <Text style={{ flex: 1, color: C.ink, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: C.sub, fontSize: 14, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line, marginLeft: 40 }} />;
}
