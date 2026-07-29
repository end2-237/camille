import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { EmptyHint } from "../components/ui";
import { getOrders, setOrderStatus } from "../api";

const TABS = [
  { key: "nouvelle", label: "Nouvelles" },
  { key: "traitee", label: "Traitées" },
  { key: "annulee", label: "Annulées" },
];

const STATUS_COLOR = { nouvelle: C.lime, traitee: C.green, annulee: C.red };

export default function Orders({ agent, onClose }) {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState("nouvelle");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await getOrders(agent?.agent_id);
      setOrders(d.orders || []);
    } catch (e) {
      Alert.alert("Commandes", e.message);
      setOrders([]);
    } finally { setBusy(false); }
  }, [agent]);

  useEffect(() => { load(); }, [load]);

  async function change(o, status) {
    try {
      await setOrderStatus(o.id, status);
      setOrders((p) => (p || []).map((x) => (x.id === o.id ? { ...x, status } : x)));
    } catch (e) { Alert.alert("Erreur", e.message); }
  }

  const list = (orders || []).filter((o) => (o.status || "nouvelle") === tab);
  const counts = {
    nouvelle: (orders || []).filter((o) => (o.status || "nouvelle") === "nouvelle").length,
    traitee: (orders || []).filter((o) => o.status === "traitee").length,
    annulee: (orders || []).filter((o) => o.status === "annulee").length,
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.md, paddingTop: 8, paddingBottom: 10 }}>
        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18 }}>Commandes</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line }}>
            <Ionicons name="close" size={18} color={C.ink} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: R.pill, padding: 4, marginHorizontal: S.md, marginBottom: 12, borderWidth: 1, borderColor: C.line }}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 34, borderRadius: R.pill, backgroundColor: tab === t.key ? C.ink : "transparent" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: tab === t.key ? C.white : C.sub }}>{t.label}</Text>
            <View style={{ backgroundColor: tab === t.key ? C.lime : "#EEE", borderRadius: R.pill, paddingHorizontal: 6, minWidth: 18, height: 16, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: C.ink }}>{counts[t.key]}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {!orders ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.ink} />}>
          {list.map((o) => {
            const items = Array.isArray(o.items) ? o.items : [];
            const phone = String(o.contact_phone || "").replace(/@c\.us$/, "");
            return (
              <View key={o.id} style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15 }}>n° {o.ref}</Text>
                  <View style={{ backgroundColor: C.ink, borderRadius: R.pill, paddingHorizontal: 10, height: 22, justifyContent: "center" }}>
                    <Text style={{ color: STATUS_COLOR[o.status] || C.lime, fontSize: 10, fontWeight: "800" }}>
                      {String(o.status || "nouvelle").toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 8 }}>
                  {items.map((it, i) => (
                    <Text key={i} style={{ color: C.ink, fontSize: 13, marginBottom: 2 }}>
                      {i + 1}. {it.name}{it.variant ? ` — ${it.variant}` : ""} ×{it.qty || 1}
                    </Text>
                  ))}
                </View>

                {o.note ? (
                  <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "#F3F7E4", borderRadius: R.pill,
                    paddingHorizontal: 10, height: 22, justifyContent: "center" }}>
                    <Text style={{ color: "#4A6B00", fontSize: 11, fontWeight: "700" }}>{o.note}</Text>
                  </View>
                ) : null}

                <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15, marginTop: 8 }}>
                  {Number(o.total || 0).toLocaleString("fr-FR")} {o.currency || "XAF"}
                </Text>
                <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>
                  {phone} · {new Date(o.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  {phone ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${phone}`)}
                      style={{ flex: 1, height: 40, borderRadius: R.pill, backgroundColor: "#E4F8EC", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
                      <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                      <Text style={{ color: C.ink, fontWeight: "700", fontSize: 12.5 }}>Répondre</Text>
                    </TouchableOpacity>
                  ) : null}
                  {o.status !== "traitee" && (
                    <TouchableOpacity onPress={() => change(o, "traitee")}
                      style={{ flex: 1, height: 40, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: C.ink, fontWeight: "800", fontSize: 12.5 }}>Traitée</Text>
                    </TouchableOpacity>
                  )}
                  {o.status !== "annulee" && (
                    <TouchableOpacity onPress={() => change(o, "annulee")}
                      style={{ width: 44, height: 40, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="close" size={16} color={C.red} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
          {!list.length && <EmptyHint text={`Aucune commande ${tab === "nouvelle" ? "nouvelle" : tab}.`} />}
        </ScrollView>
      )}
    </View>
  );
}
