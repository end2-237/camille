import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { C, R, S } from "../theme";
import { logout, pushDiagnostic, pushTest, deleteAccount, purgePushTokens } from "../api";
import { BottomDrawer } from "../components/Drawer";
import Plans from "./Plans";

// Durée de l'essai gratuit (jours). Le décompte démarre à la création du compte,
// ou à défaut à la création du premier agent.
const TRIAL_DAYS = 14;

function trialInfo(user, agents) {
  const paid = user?.plan && String(user.plan).toLowerCase() !== "free";
  if (paid) return { paid: true };

  // date de départ : compte, sinon agent le plus ancien
  let start = user?.created_at ? new Date(user.created_at) : null;
  if (!start || isNaN(start.getTime())) {
    const dates = (agents || [])
      .map((a) => (a.created_at ? new Date(a.created_at) : null))
      .filter((d) => d && !isNaN(d.getTime()));
    start = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  }
  if (!start) return { unknown: true };

  const end = new Date(start.getTime() + TRIAL_DAYS * 86400000);
  const msLeft = end.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const used = Math.min(TRIAL_DAYS, Math.max(0, TRIAL_DAYS - daysLeft));
  return {
    daysLeft,
    used,
    expired: msLeft <= 0,
    endLabel: end.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
  };
}

export default function Profile({ user, setUser, onAuthChange, agents = [] }) {
  const trial = trialInfo(user, agents);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [delPwd, setDelPwd] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState("");
  const name = user?.full_name || user?.email || "Utilisateur";
  const initials = (name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("") || "U").toUpperCase();

  async function doLogout() {
    setBusy(true);
    await logout();
    setUser(null);
    await onAuthChange();
    setBusy(false);
  }

  // Suppression du compte. On demande le mot de passe ET un mot à recopier :
  // c'est irréversible, et un téléphone déverrouillé ne doit pas suffire.
  async function doDelete() {
    setDelError("");
    if (!delPwd) { setDelError("Entre ton mot de passe."); return; }
    if (delConfirm.trim().toUpperCase() !== "SUPPRIMER") {
      setDelError("Écris SUPPRIMER en toutes lettres pour confirmer.");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(delPwd, delConfirm);
      setShowDelete(false);
      Alert.alert(
        "Compte supprimé",
        "Tes agents, ton catalogue et tes commandes ont été effacés.\n\n" +
        "Les messages déjà envoyés restent dans les conversations WhatsApp de tes clients."
      );
      setUser(null);
      await onAuthChange();
    } catch (e) {
      setDelError(e?.message || "Suppression impossible.");
    } finally {
      setDeleting(false);
    }
  }

  // Diagnostic complet : dit précisément dans quel état se trouve l'OTA.
  function otaInfo() {
    const id = Updates.updateId ? String(Updates.updateId).slice(0, 8) : "aucun (build d'origine)";
    return [
      `Actif : ${Updates.isEnabled ? "oui" : "NON"}`,
      `Version : ${Updates.runtimeVersion || "—"}`,
      `Canal : ${Updates.channel || "—"}`,
      `Mise à jour installée : ${id}`,
    ].join("\n");
  }

  async function checkUpdate() {
    setChecking(true);
    try {
      if (!Updates.isEnabled) {
        Alert.alert(
          "Mises à jour indisponibles",
          "Cette version de l'app ne contient pas le module de mise à jour.\n\n" +
          "Installe l'APK le plus récent : les suivantes arriveront ensuite toutes seules.\n\n" + otaInfo()
        );
        return;
      }
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert("Mise à jour prête", "L'app se recharge maintenant.", [
          { text: "OK", onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert("À jour", "Tu utilises déjà la dernière version.\n\n" + otaInfo());
      }
    } catch (e) {
      Alert.alert("Mises à jour", `Vérification impossible : ${e?.message || "erreur réseau"}\n\n` + otaInfo());
    } finally { setChecking(false); }
  }

  // ── Notifications : dire precisement quel maillon manque ────────────────────
  async function checkPush() {
    setPushing(true);
    try {
      const d = await pushDiagnostic();
      const lines = (d.checks || []).map((c) => `${c.ok ? "✅" : "❌"} ${c.label}${c.detail ? `\n     ${c.detail}` : ""}${c.fix ? `\n     → ${c.fix}` : ""}`);
      if (d.ready) {
        const t = await pushTest().catch((e) => ({ ok: false, skipped: e.message }));
        // `skipped` ne couvrait pas le refus de Firebase : un envoi rejeté
        // affichait « echec » sans dire pourquoi, alors que le serveur connaît
        // la cause exacte.
        lines.push("", t.ok
          ? `📨 Test envoye a ${t.sent} appareil(s)`
          : `❌ Envoi du test : ${t.reason || t.skipped || "echec"}`);
      }
      // Des jetons morts d'anciennes installations brouillent chaque test :
      // on propose de les retirer plutôt que de laisser l'écran alarmer à vie.
      const dead = (d.checks || []).find((c) => c.label === "Anciens appareils");
      const buttons = dead
        ? [
            { text: "Fermer", style: "cancel" },
            {
              text: "Nettoyer",
              onPress: async () => {
                try {
                  const r = await purgePushTokens();
                  Alert.alert("Notifications", `${r.removed || 0} ancien(s) jeton(s) retiré(s).`);
                } catch (e) {
                  Alert.alert("Notifications", e?.message || "Nettoyage impossible");
                }
              },
            },
          ]
        : undefined;
      Alert.alert(
        d.ready ? "Notifications prêtes" : "Notifications incomplètes",
        lines.join("\n"),
        buttons
      );
    } catch (e) {
      Alert.alert("Notifications", e?.message || "Diagnostic impossible");
    } finally { setPushing(false); }
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

        {/* ── Essai gratuit ── */}
        {trial.paid ? (
          <View style={{ backgroundColor: C.ink, borderRadius: R.lg, padding: S.md, marginBottom: S.md, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(198,242,78,0.16)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark-circle" size={22} color={C.lime} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>Plan {String(user?.plan).toUpperCase()} actif</Text>
              <Text style={{ color: C.subDark, fontSize: 12, marginTop: 2 }}>Merci de ta confiance 🙌</Text>
            </View>
          </View>
        ) : trial.unknown ? null : (
          <View style={{ backgroundColor: C.ink, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: C.subDark, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>ESSAI GRATUIT</Text>
              <View style={{ backgroundColor: trial.expired ? "rgba(248,113,113,0.18)" : "rgba(198,242,78,0.16)", borderRadius: R.pill, paddingHorizontal: 10, height: 22, justifyContent: "center" }}>
                <Text style={{ color: trial.expired ? C.red : C.lime, fontWeight: "800", fontSize: 10 }}>
                  {trial.expired ? "TERMINÉ" : "EN COURS"}
                </Text>
              </View>
            </View>

            <Text style={{ color: C.white, fontWeight: "800", fontSize: 26, marginTop: 8 }}>
              {trial.expired ? "Essai terminé" : `${trial.daysLeft} jour${trial.daysLeft > 1 ? "s" : ""}`}
              {!trial.expired && <Text style={{ color: C.subDark, fontWeight: "600", fontSize: 14 }}>  restant{trial.daysLeft > 1 ? "s" : ""}</Text>}
            </Text>

            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 12, overflow: "hidden" }}>
              <View style={{ width: `${Math.round((trial.used / TRIAL_DAYS) * 100)}%`, height: 8, borderRadius: 4,
                backgroundColor: trial.expired ? C.red : trial.daysLeft <= 3 ? C.red : trial.daysLeft <= 7 ? C.amber : C.lime }} />
            </View>
            <Text style={{ color: C.subDark, fontSize: 11, marginTop: 6 }}>
              {trial.expired ? "Passe à un plan pour réactiver ton agent." : `Se termine le ${trial.endLabel}`}
            </Text>

            <TouchableOpacity onPress={() => setShowPlans(true)} activeOpacity={0.9}
              style={{ marginTop: 14, height: 46, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }}>
              <Ionicons name="rocket-outline" size={17} color={C.ink} />
              <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14 }}>
                {trial.expired ? "Choisir un plan" : "Passer à Pro"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginBottom: S.md }}>
          <InfoRow icon="pricetag-outline" label="Plan" value={String(user?.plan || "free").toUpperCase()} />
          <Divider />
          <InfoRow icon="id-card-outline" label="Compte" value={`#${String(user?.id || "").slice(0, 8)}`} />
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginBottom: S.md }}>
          <NavRow icon="card-outline" label="Plans & paiement" onPress={() => setShowPlans(true)} />
          <Divider />
          <NavRow icon="cloud-download-outline" label="Rechercher une mise à jour" onPress={checkUpdate} right={checking ? <ActivityIndicator size="small" color={C.sub} /> : null} />
          <Divider />
          <NavRow icon="notifications-outline" label="Tester les notifications" onPress={checkPush} right={pushing ? <ActivityIndicator size="small" color={C.sub} /> : null} />
          <Divider />
          <NavRow icon="document-text-outline" label="Confidentialité" onPress={() => Linking.openURL("https://camille.vps.buyticle.com/privacy")} />
          <Divider />
          <NavRow icon="trash-outline" label="Supprimer mon compte" onPress={() => { setDelPwd(""); setDelConfirm(""); setDelError(""); setShowDelete(true); }} />
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

        <Text style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 18 }}>
          Camille · v1.0.0{Updates.isEnabled ? "" : " · OTA inactif"}
        </Text>
        <Text style={{ color: C.sub, fontSize: 10, textAlign: "center", marginTop: 3 }}>
          {Updates.updateId ? `MAJ ${String(Updates.updateId).slice(0, 8)}` : "build d'origine"}
        </Text>
      </ScrollView>

      <BottomDrawer visible={showPlans} onClose={() => setShowPlans(false)}>
        {({ close }) => <Plans user={user} agents={agents} onClose={close} />}
      </BottomDrawer>

      <BottomDrawer visible={showDelete} onClose={() => setShowDelete(false)}>
        {({ close }) => (
          <View style={{ padding: S.md }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink, marginBottom: 6 }}>
              Supprimer mon compte
            </Text>
            <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
              Tes agents, ton catalogue, tes commandes et tes conversations seront
              effacés définitivement. Cette action est irréversible.
              {"\n\n"}
              Les messages déjà envoyés restent dans les conversations WhatsApp de
              tes clients : ils ne nous appartiennent plus.
            </Text>

            <TextInput
              value={delPwd}
              onChangeText={setDelPwd}
              placeholder="Ton mot de passe"
              placeholderTextColor={C.sub}
              secureTextEntry
              style={{ height: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, color: C.ink, marginBottom: 10 }}
            />
            <TextInput
              value={delConfirm}
              onChangeText={setDelConfirm}
              placeholder="Écris SUPPRIMER"
              placeholderTextColor={C.sub}
              autoCapitalize="characters"
              style={{ height: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, color: C.ink, marginBottom: 10 }}
            />

            {delError ? (
              <Text style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{delError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={doDelete}
              disabled={deleting}
              style={{ height: 52, borderRadius: R.pill, backgroundColor: C.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
              {deleting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Supprimer définitivement</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={close} style={{ height: 48, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
              <Text style={{ color: C.sub, fontWeight: "600", fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
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
