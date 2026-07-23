import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { getProducts } from "../api";
import { Header } from "./AgentEdit";
import { EmptyHint } from "../components/ui";

export default function Catalogue({ agent, onClose }) {
  const [products, setProducts] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getProducts(agent.agent_id)
      .then((d) => setProducts(d.products || []))
      .catch((e) => { setErr(e.message); setProducts([]); });
  }, [agent.agent_id]);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Catalogue" onClose={onClose} />
      {!products ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }}>
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>
            {products.length} produit{products.length > 1 ? "s" : ""}
          </Text>
          {products.map((p) => {
            const img = p.image_url || (Array.isArray(p.images) ? p.images[0] : null);
            const price = p.price != null ? `${p.price}${p.price_max && p.price_max > p.price ? "–" + p.price_max : ""} ${p.currency || "XAF"}` : "Prix sur demande";
            return (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 10, marginBottom: 10 }}>
                {img ? (
                  <Image source={{ uri: img }} style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: "#F4F4F4" }} />
                ) : (
                  <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="cube-outline" size={22} color={C.sub} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{p.name}</Text>
                  {p.category ? <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>{p.category}</Text> : null}
                  <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13, marginTop: 4 }}>{price}</Text>
                </View>
                {p.stock != null && <View style={{ backgroundColor: "#F4F4F4", borderRadius: R.pill, paddingHorizontal: 8, height: 22, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.sub, fontSize: 10, fontWeight: "600" }}>stock {p.stock}</Text>
                </View>}
              </View>
            );
          })}
          {!products.length && <EmptyHint text={err || "Catalogue vide."} />}
        </ScrollView>
      )}
    </View>
  );
}
