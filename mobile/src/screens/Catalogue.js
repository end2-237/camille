import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, Image, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { getProducts, createProduct, updateProduct, deleteProduct } from "../api";
import { Header } from "./AgentEdit";
import { EmptyHint } from "../components/ui";

const { width } = Dimensions.get("window");
const COL = (width - S.md * 2 - 10) / 2; // 2 colonnes

function money(p) {
  if (p?.price == null) return "Prix sur demande";
  const max = p.price_max && p.price_max > p.price ? `–${p.price_max}` : "";
  return `${Number(p.price).toLocaleString("fr-FR")}${max} ${p.currency || "XAF"}`;
}
function imgOf(p) {
  return p.image_url || (Array.isArray(p.images) ? p.images[0] : null);
}

export default function Catalogue({ agent, onClose }) {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [edit, setEdit] = useState(null); // produit en cours d'édition (ou {} pour un nouveau)

  const load = React.useCallback(() => {
    getProducts(agent.agent_id)
      .then((d) => setProducts(d.products || []))
      .catch((e) => { Alert.alert("Catalogue", e.message); setProducts([]); });
  }, [agent.agent_id]);

  useEffect(() => { load(); }, [load]);

  const cats = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => { if (p.category) set.add(p.category); });
    return ["all", ...Array.from(set)];
  }, [products]);

  const list = useMemo(() => {
    let l = products || [];
    if (cat !== "all") l = l.filter((p) => p.category === cat);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((p) => `${p.name || ""} ${p.category || ""}`.toLowerCase().includes(s));
    return l;
  }, [products, cat, q]);

  if (edit) {
    return (
      <ProductForm
        agentId={agent.agent_id}
        product={edit}
        onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); setProducts(null); load(); }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title="Catalogue" onClose={onClose} />

      {/* Recherche + ajout */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: S.md, marginBottom: 10 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.white,
          borderRadius: R.pill, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, height: 44 }}>
          <Ionicons name="search" size={16} color={C.sub} />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un produit…" placeholderTextColor={C.sub}
            style={{ flex: 1, marginLeft: 8, fontSize: 13.5, color: C.ink }} />
          {q ? (
            <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close-circle" size={16} color={C.sub} /></TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setEdit({})} activeOpacity={0.85}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={22} color={C.lime} />
        </TouchableOpacity>
      </View>

      {/* Filtres par catégorie */}
      {cats.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: S.md, gap: 8, paddingBottom: 10 }}>
          {cats.map((c) => {
            const on = cat === c;
            return (
              <TouchableOpacity key={c} onPress={() => setCat(c)}
                style={{ paddingHorizontal: 16, height: 36, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
                  backgroundColor: on ? C.lime : C.white, borderWidth: 1, borderColor: on ? C.lime : C.line }}>
                <Text style={{ fontSize: 12.5, fontWeight: on ? "800" : "600", color: C.ink }}>
                  {c === "all" ? "Tous" : c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {!products ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>
            {list.length} produit{list.length > 1 ? "s" : ""}{cat !== "all" ? ` · ${cat}` : ""}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {list.map((p) => {
              const img = imgOf(p);
              const promo = p.price_max && p.price_max > p.price;
              return (
                <TouchableOpacity key={p.id} activeOpacity={0.9} onPress={() => setEdit(p)}
                  style={{ width: COL, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
                  <View style={{ height: COL * 0.82, backgroundColor: "#F3F4F2" }}>
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="image-outline" size={26} color={C.sub} />
                      </View>
                    )}
                    {promo ? (
                      <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: C.lime, borderRadius: R.pill, paddingHorizontal: 8, height: 22, justifyContent: "center" }}>
                        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 10 }}>PROMO</Text>
                      </View>
                    ) : null}
                    {p.stock != null && (
                      <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: R.pill, paddingHorizontal: 8, height: 22, justifyContent: "center" }}>
                        <Text style={{ color: p.stock > 0 ? C.ink : C.red, fontWeight: "700", fontSize: 10 }}>
                          {p.stock > 0 ? `${p.stock} en stock` : "épuisé"}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ padding: 10 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontWeight: "700", fontSize: 13 }}>{p.name}</Text>
                    {p.category ? <Text style={{ color: C.sub, fontSize: 10.5, marginTop: 1 }}>{p.category}</Text> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>{money(p)}</Text>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="create-outline" size={15} color={C.lime} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {!list.length && (
            <View style={{ alignItems: "center", marginTop: 24 }}>
              <EmptyHint text={q || cat !== "all" ? "Aucun produit ne correspond." : "Catalogue vide."} />
              <TouchableOpacity onPress={() => setEdit({})}
                style={{ marginTop: 14, height: 46, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.lime,
                  alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }}>
                <Ionicons name="add-circle-outline" size={17} color={C.ink} />
                <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13.5 }}>Ajouter un produit</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Formulaire produit (création / édition) ─────────────────────────────────
function ProductForm({ agentId, product, onClose, onSaved }) {
  const isNew = !product?.id;
  const [f, setF] = useState({
    name: product.name || "",
    category: product.category || "",
    price: product.price != null ? String(product.price) : "",
    price_max: product.price_max != null ? String(product.price_max) : "",
    currency: product.currency || "XAF",
    stock: product.stock != null ? String(product.stock) : "",
    image_url: product.image_url || "",
    product_url: product.product_url || "",
    description: product.description || "",
  });
  const [busy, setBusy] = useState(false);

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  async function save() {
    if (!f.name.trim()) { Alert.alert("Nom requis", "Donne un nom au produit."); return; }
    const body = {
      name: f.name.trim(),
      category: f.category.trim() || null,
      price: f.price ? Number(f.price) : null,
      price_max: f.price_max ? Number(f.price_max) : null,
      currency: f.currency.trim() || "XAF",
      stock: f.stock ? Number(f.stock) : null,
      image_url: f.image_url.trim() || null,
      product_url: f.product_url.trim() || null,
      description: f.description.trim() || null,
    };
    setBusy(true);
    try {
      if (isNew) await createProduct(agentId, body);
      else await updateProduct(agentId, product.id, body);
      onSaved();
    } catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  }

  function confirmDelete() {
    Alert.alert("Supprimer", `Supprimer « ${product.name} » du catalogue ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          setBusy(true);
          try { await deleteProduct(agentId, product.id); onSaved(); }
          catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={isNew ? "Nouveau produit" : "Modifier le produit"} onClose={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {f.image_url ? (
            <Image source={{ uri: f.image_url }} style={{ width: "100%", height: 170, borderRadius: R.lg, marginBottom: 14, backgroundColor: "#F3F4F2" }} resizeMode="cover" />
          ) : null}

          <Field label="Nom du produit *" value={f.name} onChangeText={(v) => set("name", v)} placeholder="Ex : Sneakers Air Max" />
          <Field label="Catégorie" value={f.category} onChangeText={(v) => set("category", v)} placeholder="Ex : Chaussures" />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Prix" value={f.price} onChangeText={(v) => set("price", v)} keyboardType="numeric" placeholder="25000" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Prix barré" value={f.price_max} onChangeText={(v) => set("price_max", v)} keyboardType="numeric" placeholder="30000" />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Devise" value={f.currency} onChangeText={(v) => set("currency", v)} placeholder="XAF" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Stock" value={f.stock} onChangeText={(v) => set("stock", v)} keyboardType="numeric" placeholder="10" />
            </View>
          </View>

          <Field label="Image (URL)" value={f.image_url} onChangeText={(v) => set("image_url", v)} autoCapitalize="none" placeholder="https://…" />
          <Field label="Lien de commande" value={f.product_url} onChangeText={(v) => set("product_url", v)} autoCapitalize="none" placeholder="https://…" />
          <Field label="Description" value={f.description} onChangeText={(v) => set("description", v)} multiline placeholder="Décris le produit en une phrase" />

          <TouchableOpacity onPress={save} disabled={busy}
            style={{ height: 52, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 4 }}>
            {busy ? <ActivityIndicator color={C.ink} /> : (
              <>
                <Ionicons name="save-outline" size={18} color={C.ink} />
                <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14.5 }}>{isNew ? "Ajouter au catalogue" : "Enregistrer"}</Text>
              </>
            )}
          </TouchableOpacity>

          {!isNew && (
            <TouchableOpacity onPress={confirmDelete} disabled={busy}
              style={{ height: 48, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.white,
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, marginTop: 10 }}>
              <Ionicons name="trash-outline" size={17} color={C.red} />
              <Text style={{ color: C.red, fontWeight: "700", fontSize: 13.5 }}>Supprimer ce produit</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, multiline, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: C.sub, fontSize: 11, marginBottom: 5 }}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={C.sub}
        style={{ backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line,
          paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0, height: multiline ? 84 : 48,
          fontSize: 14, color: C.ink, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}
