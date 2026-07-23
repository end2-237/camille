import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { C, R, S } from "../theme";
import { logout } from "../api";
import { BottomDrawer } from "../components/Drawer";
import Plans from "./Plans";

export default function Profile({ user, setUser, onAuthChange, agents = [] }) {
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const name = user?.full_name || user?.email || "Utilisateur";
  const initials = (name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("") || "U").toUpperCase();

  async function doLogout() {
    setBusy(true);
    await logout();
    setUser(null);
    await onAuthChange();
    setBusy(false);
  }

  async function checkUpdate() {
    setChecking(true);
    try {
      if (!Updates.isEnabled) {
        Alert.alert("Mises à jour", "Les mises à jour OTA seront actives dès la connexion du compte Expo (EAS Update).");
        return;
      }
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert("Mise à jour prête", "L'app va redémarrer pour appliquer la mise à jour.", [
          { text: "OK", onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert("À jour", "Tu utilises déjà la dernière version.");
      }
    } catch (e) {
      Alert.alert("Mises à jour", "Impossible de vérifier pour le moment.");
    } finally { setChecking(false); }
  }

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 92 }}>
        <View style={{ alignItems: "center", marginTop: 16, marginBottom: 22 }}>
          <View style={{ width: 84, height: 84, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.lime, fontWeight: "800", fontSize: 30 }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink, marginTop: 14 }}>{name}</Text>
          <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{user?.email}</Text>
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginBottom: S.md }}>
          <InfoRow icon="pricetag-outline" label="Plan" value={String(user?.plan || "free").toUpperCase()} />
          <Divider />
          <InfoRow icon="id-card-outline" label="Compte" value={`#${String(user?.id || "").slice(0, 8)}`} />
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginBottom: S.md }}>
          <NavRow icon="card-outline" label="Plans & paiement" onPress={() => setShowPlans(true)} />
          <Divider />
          <NavRow icon="cloud-download-outline" label="Rechercher une mise à jour" onPress={checkUpdate} right={checking ? <ActivityIndicator size="small" color={C.sub} /> : null} />
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

        <Text style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 18 }}>Camille · v1.0.0</Text>
      </ScrollView>

      <BottomDrawer visible={showPlans} onClose={() => setShowPlans(false)}>
        {({ close }) => <Plans user={user} agents={agents} onClose={close} />}
      </BottomDrawer>
    </>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, gap: 10 }}>
      <Ionicons name={icon} size={18} color={C.ink} />
      <Text style={{ flex: 1, color: C.ink, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: C.sub, fontSize: 14, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function NavRow({ icon, label, onPress, right }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 12, gap: 10 }}>
      <Ionicons name={icon} size={18} color={C.ink} />
      <Text style={{ flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" }}>{label}</Text>
      {right || <Ionicons name="chevron-forward" size={16} color={C.sub} />}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line, marginLeft: 40 }} />;
}
