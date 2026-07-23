import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { logout } from "../api";

export default function Profile({ user, setUser, onAuthChange }) {
  const [busy, setBusy] = useState(false);
  const name = user?.full_name || user?.email || "Utilisateur";
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
        <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{user?.email}</Text>
      </View>

      <View style={{ backgroundColor: C.white, borderRadius: R.lg, padding: 4, marginBottom: S.md, borderWidth: 1, borderColor: C.line }}>
        <Row icon="pricetag-outline" label="Plan" value={String(user?.plan || "free").toUpperCase()} />
        <Divider />
        <Row icon="id-card-outline" label="Compte" value={`#${String(user?.id || "").slice(0, 8)}`} />
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
