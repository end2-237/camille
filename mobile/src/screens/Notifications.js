import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S, BOTTOM_INSET } from "../theme";
import { EmptyHint } from "../components/ui";
import { getNotifications, markNotification, markAllNotifications } from "../api";

// Chaque type a sa couleur et son icône : on doit reconnaître une nouvelle
// commande d'un simple coup d'œil, sans lire.
const KIND = {
  commande: { icon: "receipt", bg: "#F3F7E4", fg: "#4A6B00", label: "Commande" },
  alerte:   { icon: "warning", bg: "#FDF1DC", fg: "#8A5A00", label: "Alerte" },
  systeme:  { icon: "information-circle", bg: "#E8EEF9", fg: "#2557A7", label: "Système" },
};
const kindOf = (k) => KIND[k] || KIND.systeme;

function whenLabel(iso) {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 60 * 24) return `il y a ${Math.floor(min / 60)} h`;
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Notifications({ onOpenOrders }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await getNotifications(80);
      setErr(d?.error || "");
      setList(d?.notifications || []);
    } catch (e) {
      setErr(e.message);
      setList([]);
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unread = (list || []).filter((n) => !n.read_at).length;

  async function open(n) {
    if (!n.read_at) {
      // Optimiste : l'utilisateur voit l'effet immédiatement.
      setList((p) => (p || []).map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markNotification(n.id).catch(() => {});
    }
    if (n.kind === "commande" && onOpenOrders) onOpenOrders();
  }

  async function readAll() {
    setList((p) => (p || []).map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    markAllNotifications().catch(() => {});
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: S.md, paddingTop: 8, paddingBottom: 12 }}>
        <View>
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 22, letterSpacing: -0.4 }}>Notifications</Text>
          <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
            {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}
          </Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={readAll}
            style={{ paddingHorizontal: 14, height: 34, borderRadius: R.pill, backgroundColor: C.ink,
              alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.white, fontSize: 12, fontWeight: "700" }}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {err ? (
        <View style={{ marginHorizontal: S.md, padding: 12, borderRadius: R.md, backgroundColor: "#FDECEC" }}>
          <Text style={{ color: "#c0392b", fontSize: 12.5 }}>{err}</Text>
        </View>
      ) : null}

      {!list ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 92 + BOTTOM_INSET }}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.ink} />}>
          {list.map((n) => {
            const k = kindOf(n.kind);
            const isNew = !n.read_at;
            return (
              <TouchableOpacity key={n.id} activeOpacity={0.85} onPress={() => open(n)}
                style={{ flexDirection: "row", gap: 12, padding: S.md, marginBottom: 8,
                  borderRadius: R.lg, borderWidth: 1,
                  borderColor: isNew ? "rgba(198,242,78,0.9)" : C.line,
                  backgroundColor: C.white }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.bg,
                  alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={k.icon} size={19} color={k.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ flex: 1, color: C.ink, fontWeight: isNew ? "800" : "600", fontSize: 14 }}
                      numberOfLines={2}>
                      {n.title}
                    </Text>
                    {isNew && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.lime }} />}
                  </View>
                  {n.body ? (
                    <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 3 }} numberOfLines={3}>{n.body}</Text>
                  ) : null}
                  <Text style={{ color: C.sub, fontSize: 11, marginTop: 5 }}>
                    {k.label} · {whenLabel(n.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {!list.length && !err && (
            <EmptyHint text="Aucune notification pour l'instant. Les nouvelles commandes apparaîtront ici." />
          )}
        </ScrollView>
      )}
    </View>
  );
}
