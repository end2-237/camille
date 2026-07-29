import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Alert, Linking, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { EmptyHint } from "../components/ui";
import { BottomDrawer } from "../components/Drawer";
import { getOrders, setOrderStatus } from "../api";

// Cycle de vie : à traiter → en traitement → livrée. "traitee" est l'ancien
// statut des commandes créées avant le suivi ; on le traite comme "en traitement".
const ST = {
  nouvelle:      { label: "À traiter",     color: C.lime,  chip: "#F3F7E4", ink: "#4A6B00" },
  en_traitement: { label: "En traitement", color: C.amber, chip: "#FDF1DC", ink: "#8A5A00" },
  traitee:       { label: "En traitement", color: C.amber, chip: "#FDF1DC", ink: "#8A5A00" },
  livree:        { label: "Livrée",        color: C.green, chip: "#E4F8EC", ink: "#0e6b45" },
  annulee:       { label: "Annulée",       color: C.red,   chip: "#FDECEC", ink: "#c0392b" },
};
const stOf = (o) => ST[o?.status] || ST.nouvelle;

const TABS = [
  { key: "nouvelle", label: "À traiter", match: (s) => !s || s === "nouvelle" },
  { key: "encours",  label: "En cours",  match: (s) => s === "en_traitement" || s === "traitee" },
  { key: "livree",   label: "Livrées",   match: (s) => s === "livree" },
  { key: "annulee",  label: "Annulées",  match: (s) => s === "annulee" },
];

// Aperçu carto sans clé d'API : on calcule la tuile qui contient le point et on
// place le marqueur à sa position exacte dedans.
// Les tuiles viennent de CARTO : tile.openstreetmap.org renvoie 403 aux clients
// applicatifs (leur politique d'usage interdit les apps), CARTO les autorise.
const TILE = 256;
const ZOOM = 16;
const TILE_HOST = "https://a.basemaps.cartocdn.com/rastertiles/voyager";
const TILE_HEADERS = { "User-Agent": "Camille/1.0 (support@camille.local)" };

function tileOf(lat, lng) {
  const n = 2 ** ZOOM;
  const x = ((lng + 180) / 360) * n;
  const la = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n;
  return { tx: Math.floor(x), ty: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

function itemsOf(o) {
  if (Array.isArray(o?.items)) return o.items;
  try { return JSON.parse(String(o?.items || "[]")); } catch { return []; }
}
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const phoneOf = (o) => String(o?.contact_phone || "").replace(/@c\.us$/, "");

function placeOf(o) {
  const hasGeo = o?.lat != null && o?.lng != null;
  return {
    hasGeo,
    label: o?.place_label || o?.address || (hasGeo ? `${Number(o.lat).toFixed(5)}, ${Number(o.lng).toFixed(5)}` : ""),
  };
}

function openMaps(o) {
  const { hasGeo, label } = placeOf(o);
  Linking.openURL(hasGeo
    ? `https://www.google.com/maps?q=${o.lat},${o.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(label)}`);
}

function MapPreview({ lat, lng, height = 120 }) {
  const [failed, setFailed] = useState(false);
  const { tx, ty, fx, fy } = tileOf(Number(lat), Number(lng));
  // Si le fournisseur de tuiles refuse, on n'affiche pas un carré gris muet :
  // l'adresse et le lien Maps juste en dessous suffisent.
  if (failed) return null;
  const uris = [-1, 0, 1].map((d) => `${TILE_HOST}/${ZOOM}/${tx + d}/${ty}.png`);
  return (
    <View style={{ height, overflow: "hidden", backgroundColor: "#E8E8E8" }}>
      <View style={{ flexDirection: "row", position: "absolute", top: -(fy * TILE - height / 2), left: 0 }}>
        {uris.map((u) => (
          <Image key={u} source={{ uri: u, headers: TILE_HEADERS }} style={{ width: TILE, height: TILE }}
            onError={() => setFailed(true)} />
        ))}
      </View>
      <View style={{ position: "absolute", left: TILE + fx * TILE - 9, top: height / 2 - 18 }}>
        <Ionicons name="location" size={26} color={C.red} />
      </View>
      <Text style={{ position: "absolute", right: 4, bottom: 2, fontSize: 8, color: "#5A5A5A" }}>
        © OpenStreetMap · CARTO
      </Text>
    </View>
  );
}

// Bloc livraison de la carte : tap = ouvre la commande en entier.
function Destination({ order: o, onOpen }) {
  const { hasGeo, label } = placeOf(o);
  if (!label) return null;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen}
      style={{ marginTop: 10, borderRadius: R.md, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
      {hasGeo && <MapPreview lat={o.lat} lng={o.lng} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#FAFAFA" }}>
        <Ionicons name="location" size={15} color={C.red} />
        <Text style={{ flex: 1, color: C.ink, fontSize: 11.5 }} numberOfLines={2}>{label}</Text>
        <Ionicons name="chevron-forward" size={14} color={C.sub} />
      </View>
    </TouchableOpacity>
  );
}

export default function Orders({ agent, onClose }) {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState("nouvelle");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);

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

  const change = useCallback(async (o, status) => {
    try {
      const d = await setOrderStatus(o.id, status);
      const fresh = d?.order || { ...o, status };
      setOrders((p) => (p || []).map((x) => (x.id === o.id ? { ...x, ...fresh } : x)));
      setSel((s) => (s && s.id === o.id ? { ...s, ...fresh } : s));
    } catch (e) { Alert.alert("Erreur", e.message); }
  }, []);

  const counts = {};
  TABS.forEach((t) => { counts[t.key] = (orders || []).filter((o) => t.match(o.status)).length; });
  const list = (orders || []).filter((o) => (TABS.find((t) => t.key === tab) || TABS[0]).match(o.status));

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: S.md, gap: 8, paddingBottom: 12 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.85}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 34,
                borderRadius: R.pill, backgroundColor: on ? C.ink : C.white, borderWidth: 1, borderColor: on ? C.ink : C.line }}>
              <Text style={{ fontSize: 12, fontWeight: on ? "700" : "600", color: on ? C.white : C.sub }}>{t.label}</Text>
              <View style={{ backgroundColor: on ? "rgba(198,242,78,0.22)" : "#EEE", borderRadius: R.pill,
                paddingHorizontal: 6, minWidth: 18, height: 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: on ? C.lime : C.sub }}>{counts[t.key]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!orders ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.ink} />}>
          {list.map((o) => {
            const items = itemsOf(o);
            const st = stOf(o);
            return (
              <TouchableOpacity key={o.id} activeOpacity={0.9} onPress={() => setSel(o)}
                style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15 }}>n° {o.ref}</Text>
                  <View style={{ backgroundColor: st.chip, borderRadius: R.pill, paddingHorizontal: 10, height: 22, justifyContent: "center" }}>
                    <Text style={{ color: st.ink, fontSize: 10, fontWeight: "800" }}>{st.label.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 8 }}>
                  {items.slice(0, 3).map((it, i) => (
                    <Text key={i} style={{ color: C.ink, fontSize: 13, marginBottom: 2 }}>
                      {i + 1}. {it.name}{it.variant ? ` — ${it.variant}` : ""} ×{it.qty || 1}
                    </Text>
                  ))}
                  {items.length > 3 && (
                    <Text style={{ color: C.sub, fontSize: 12 }}>+ {items.length - 3} autre(s)</Text>
                  )}
                </View>

                {o.note ? (
                  <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "#F3F7E4", borderRadius: R.pill,
                    paddingHorizontal: 10, height: 22, justifyContent: "center" }}>
                    <Text style={{ color: "#4A6B00", fontSize: 11, fontWeight: "700" }}>{o.note}</Text>
                  </View>
                ) : null}

                <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15, marginTop: 8 }}>
                  {fmt(o.total)} {o.currency || "XAF"}
                </Text>
                <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>
                  {o.customer_name ? `${o.customer_name} · ` : ""}{phoneOf(o)} ·{" "}
                  {new Date(o.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>

                <Destination order={o} onOpen={() => setSel(o)} />

                <Actions order={o} onChange={change} compact />
              </TouchableOpacity>
            );
          })}

          {!list.length && <EmptyHint text="Aucune commande dans cet onglet." />}
        </ScrollView>
      )}

      <BottomDrawer visible={!!sel} onClose={() => setSel(null)}>
        {({ close }) => sel && <OrderDetail order={sel} onChange={change} onClose={close} />}
      </BottomDrawer>
    </View>
  );
}

// Boutons d'avancement : une seule action principale selon l'étape en cours.
function Actions({ order: o, onChange, compact }) {
  const s = o.status || "nouvelle";
  const inProgress = s === "en_traitement" || s === "traitee";
  const done = s === "livree" || s === "annulee";
  const phone = phoneOf(o);
  const h = compact ? 40 : 46;

  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      {phone ? (
        <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${phone}`)}
          style={{ width: compact ? 46 : 52, height: h, borderRadius: R.pill, backgroundColor: "#E4F8EC",
            alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
        </TouchableOpacity>
      ) : null}

      {s === "nouvelle" && (
        <TouchableOpacity onPress={() => onChange(o, "en_traitement")}
          style={{ flex: 1, height: h, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }}>
          <Ionicons name="sync" size={15} color={C.lime} />
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 13 }}>Mettre en traitement</Text>
        </TouchableOpacity>
      )}

      {inProgress && (
        <TouchableOpacity onPress={() => onChange(o, "livree")}
          style={{ flex: 1, height: h, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }}>
          <Ionicons name="checkmark-circle" size={16} color={C.ink} />
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }}>Marquer livrée</Text>
        </TouchableOpacity>
      )}

      {!done && (
        <TouchableOpacity onPress={() => onChange(o, "annulee")}
          style={{ width: compact ? 46 : 52, height: h, borderRadius: R.pill, borderWidth: 1, borderColor: C.line,
            alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close" size={16} color={C.red} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Suivi : les étapes franchies portent leur horodatage réel.
function Tracking({ order: o }) {
  const cancelled = o.status === "annulee";
  const steps = [
    { key: "recue",   label: "Commande reçue",   at: o.created_at,    icon: "receipt-outline" },
    { key: "traite",  label: "En traitement",    at: o.processing_at, icon: "sync-outline" },
    { key: "livree",  label: "Livrée",           at: o.delivered_at,  icon: "checkmark-done-outline" },
  ];
  return (
    <View style={{ marginTop: 4 }}>
      {steps.map((sp, i) => {
        const on = !!sp.at;
        const last = i === steps.length - 1;
        return (
          <View key={sp.key} style={{ flexDirection: "row" }}>
            <View style={{ alignItems: "center", width: 30 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
                backgroundColor: on ? (cancelled ? "#FDECEC" : C.lime) : "#F0F0F0" }}>
                <Ionicons name={sp.icon} size={12} color={on ? C.ink : C.sub} />
              </View>
              {!last && <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: on ? C.lime : "#EEE" }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 14, paddingTop: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: on ? "700" : "600", color: on ? C.ink : C.sub }}>{sp.label}</Text>
              <Text style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>
                {on ? new Date(sp.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "En attente"}
              </Text>
            </View>
          </View>
        );
      })}
      {cancelled && (
        <Text style={{ marginTop: 10, fontSize: 12, fontWeight: "700", color: C.red }}>Commande annulée</Text>
      )}
    </View>
  );
}

function OrderDetail({ order: o, onChange, onClose }) {
  const items = itemsOf(o);
  const st = stOf(o);
  const { hasGeo, label } = placeOf(o);
  const cur = o.currency || "XAF";

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: S.md, paddingTop: 4, paddingBottom: 12 }}>
        <View>
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 19 }}>Commande n° {o.ref}</Text>
          <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
            {new Date(o.created_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
          </Text>
        </View>
        <View style={{ backgroundColor: st.chip, borderRadius: R.pill, paddingHorizontal: 12, height: 26, justifyContent: "center" }}>
          <Text style={{ color: st.ink, fontSize: 11, fontWeight: "800" }}>{st.label.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Block title="Produits">
          {items.map((it, i) => {
            const q = it.qty || 1;
            const u = Number(it.price || 0);
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10,
                borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: "#F0F0F0" }}>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#F4F4F4",
                  alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: C.ink }}>×{q}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontSize: 14, fontWeight: "700" }}>{it.name}</Text>
                  {it.variant ? <Text style={{ color: C.sub, fontSize: 11.5, marginTop: 1 }}>{it.variant}</Text> : null}
                  <Text style={{ color: C.sub, fontSize: 11.5, marginTop: 1 }}>{fmt(u)} {cur} l&apos;unité</Text>
                </View>
                <Text style={{ color: C.ink, fontSize: 14, fontWeight: "800" }}>{fmt(u * q)} {cur}</Text>
              </View>
            );
          })}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
            <Text style={{ color: C.sub, fontSize: 13, fontWeight: "600" }}>Total</Text>
            <Text style={{ color: C.ink, fontSize: 19, fontWeight: "800" }}>{fmt(o.total)} {cur}</Text>
          </View>
        </Block>

        <Block title="Client">
          <Line label="Nom" value={o.customer_name || "—"} />
          <Line label="Téléphone" value={phoneOf(o) || "—"} />
          {o.note ? <Line label="Mode" value={o.note} /> : null}
        </Block>

        {label ? (
          <Block title="Livraison" pad={false}>
            {hasGeo && <MapPreview lat={o.lat} lng={o.lng} height={150} />}
            <TouchableOpacity onPress={() => openMaps(o)} activeOpacity={0.8}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12 }}>
              <Ionicons name="location" size={16} color={C.red} />
              <Text style={{ flex: 1, color: C.ink, fontSize: 12.5 }}>{label}</Text>
              <Text style={{ color: C.ink, fontSize: 12, fontWeight: "700" }}>Ouvrir</Text>
              <Ionicons name="open-outline" size={14} color={C.sub} />
            </TouchableOpacity>
          </Block>
        ) : null}

        <Block title="Suivi">
          <Tracking order={o} />
        </Block>

        <Actions order={o} onChange={onChange} />

        <TouchableOpacity onPress={onClose}
          style={{ height: 44, borderRadius: R.pill, alignItems: "center", justifyContent: "center", marginTop: 10 }}>
          <Text style={{ color: C.sub, fontSize: 13, fontWeight: "600" }}>Fermer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Block({ title, children, pad = true }) {
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line,
        padding: pad ? S.md : 0, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function Line({ label, value }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7 }}>
      <Text style={{ color: C.sub, fontSize: 13, width: 100 }}>{label}</Text>
      <Text style={{ color: C.ink, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}
