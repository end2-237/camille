import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  RefreshControl, Alert, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { EmptyHint } from "../components/ui";
import { getComplaints, resolveComplaint } from "../api";

// ─────────────────────────────────────────────────────────────────────────────
// Réclamations.
//
// L'agent promet au client de « transmettre à l'équipe » quand il signale un
// problème. Cet écran est ce à quoi cette promesse aboutit — sans lui, le
// message se perdait dans la conversation et personne ne le traitait.
//
// Un seul geste compte ici : répondre au client. Tout le reste est secondaire,
// donc discret.
// ─────────────────────────────────────────────────────────────────────────────

const KIND = {
  complaint:     { label: "Réclamation",  icon: "alert-circle",       color: "#F87171", chip: "#FDECEC" },
  after_sales:   { label: "Suivi",        icon: "cube-outline",       color: "#FBBF24", chip: "#FDF1DC" },
  talk_to_human: { label: "Veut parler",  icon: "person-circle",      color: "#3ECf8E", chip: "#E7F8F0" },
};

const kindOf = (c) => KIND[c?.content?.kind] || KIND.complaint;

function since(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : `il y a ${j} jours`;
}

export default function Complaints() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("active"); // active | done
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await getComplaints();
      setItems(Array.isArray(d?.complaints) ? d.complaints : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = items.filter((c) => (tab === "done" ? c.status === "done" : c.status !== "done"));
  const openCount = items.filter((c) => c.status !== "done").length;

  async function setStatus(c, status) {
    setBusy(c.id);
    try {
      await resolveComplaint(c.id, status);
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, status } : x)));
    } catch (e) {
      Alert.alert("Réclamations", e?.message || "Mise à jour impossible.");
    } finally {
      setBusy("");
    }
  }

  function answer(c) {
    const tel = String(c.phone || "").replace(/[^0-9]/g, "");
    if (!tel) {
      Alert.alert("Pas de numéro", "Cette réclamation n'a pas de contact joignable.");
      return;
    }
    const msg =
      "Bonjour, c'est " + (c.business_name || "nous") + ". " +
      "On a bien reçu ton message et on s'en occupe.";
    Linking.openURL(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.ink} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: S.md, paddingBottom: 110 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.ink} />
      }
    >
      <View style={{ marginBottom: 6 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.5 }}>
          Réclamations
        </Text>
        <Text style={{ color: C.sub, fontSize: 13, marginTop: 3 }}>
          {openCount === 0
            ? "Rien en attente. C'est bon signe."
            : `${openCount} client${openCount > 1 ? "s" : ""} attend${openCount > 1 ? "ent" : ""} une réponse`}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginVertical: 14 }}>
        {[
          { k: "active", label: "À traiter" },
          { k: "done", label: "Traitées" },
        ].map((t) => {
          const on = tab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              onPress={() => setTab(t.k)}
              style={{ paddingHorizontal: 16, height: 36, borderRadius: R.pill, alignItems: "center",
                justifyContent: "center", backgroundColor: on ? C.ink : C.white,
                borderWidth: 1, borderColor: on ? C.ink : C.line }}>
              <Text style={{ color: on ? C.white : C.sub, fontWeight: "700", fontSize: 13 }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {shown.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.white,
            borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
            <Ionicons
              name={tab === "done" ? "checkmark-done-outline" : "happy-outline"}
              size={28}
              color={C.sub}
            />
          </View>
          <Text style={{ color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 14 }}>
            {tab === "done" ? "Aucune réclamation traitée" : "Aucune réclamation"}
          </Text>
          <EmptyHint
            text={
              tab === "done"
                ? "Les réclamations que tu clôtures apparaîtront ici."
                : "Quand un client signale un souci sur WhatsApp, il arrive ici et tu peux lui répondre en un geste."
            }
          />
        </View>
      ) : (
        shown.map((c) => {
          const k = kindOf(c);
          const done = c.status === "done";
          return (
            <View
              key={c.id}
              style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line,
                padding: S.md, marginBottom: 10, opacity: done ? 0.65 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9,
                  height: 24, borderRadius: R.pill, backgroundColor: k.chip }}>
                  <Ionicons name={k.icon} size={13} color={k.color} />
                  <Text style={{ color: k.color, fontSize: 11.5, fontWeight: "800" }}>{k.label}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Text style={{ color: C.sub, fontSize: 11.5 }}>{since(c.created_at)}</Text>
              </View>

              <Text style={{ color: C.ink, fontSize: 14.5, lineHeight: 21, marginTop: 10 }}>
                {c.content?.message || "(message vide)"}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <Ionicons name="call-outline" size={13} color={C.sub} />
                <Text style={{ color: C.sub, fontSize: 12.5 }}>
                  {c.phone || "numéro inconnu"}
                  {c.business_name ? ` · ${c.business_name}` : ""}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => answer(c)}
                  style={{ flex: 1, height: 44, borderRadius: R.pill, backgroundColor: C.ink,
                    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }}>
                  <Ionicons name="logo-whatsapp" size={17} color={C.lime} />
                  <Text style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>Répondre</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStatus(c, done ? "active" : "done")}
                  disabled={busy === c.id}
                  style={{ width: 52, height: 44, borderRadius: R.pill, borderWidth: 1, borderColor: C.line,
                    alignItems: "center", justifyContent: "center" }}>
                  {busy === c.id ? (
                    <ActivityIndicator size="small" color={C.sub} />
                  ) : (
                    <Ionicons name={done ? "arrow-undo-outline" : "checkmark"} size={18} color={C.sub} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
