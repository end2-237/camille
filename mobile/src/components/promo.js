import React from "react";
import { View, Text, ImageBackground, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";

// Bandeau publicitaire plein largeur : image + description + bouton.
export function AdCard({ image, tag, title, description, cta, url, tint = "rgba(16,16,18,0.62)" }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => url && Linking.openURL(url)}
      style={{ borderRadius: R.lg, overflow: "hidden", marginBottom: S.md }}>
      <ImageBackground source={{ uri: image }} style={{ width: "100%", minHeight: 172 }} resizeMode="cover">
        <View style={{ flex: 1, backgroundColor: tint, padding: S.md, justifyContent: "flex-end" }}>
          {tag ? (
            <View style={{ alignSelf: "flex-start", backgroundColor: C.lime, borderRadius: R.pill, paddingHorizontal: 10, height: 24, justifyContent: "center", marginBottom: 8 }}>
              <Text style={{ color: C.ink, fontWeight: "800", fontSize: 10, letterSpacing: 0.4 }}>{tag}</Text>
            </View>
          ) : null}
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 18, letterSpacing: -0.3 }}>{title}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: 4, lineHeight: 18 }}>{description}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: C.white,
            alignSelf: "flex-start", paddingHorizontal: 14, height: 38, borderRadius: R.pill }}>
            <Text style={{ color: C.ink, fontWeight: "700", fontSize: 13 }}>{cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={C.ink} />
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

// Section plan / mise à niveau.
export function PlanCard({ plan = "free", url }) {
  const isFree = String(plan).toLowerCase() === "free";
  const features = ["Agents illimités", "Statistiques avancées", "Sessions ultra-stables", "Support prioritaire"];
  return (
    <View style={{ borderRadius: R.lg, overflow: "hidden", marginBottom: S.md, backgroundColor: C.ink, padding: S.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.subDark, fontSize: 11, letterSpacing: 0.4 }}>PLAN ACTUEL</Text>
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 20, marginTop: 2 }}>{String(plan).toUpperCase()}</Text>
        </View>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(198,242,78,0.15)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="rocket-outline" size={22} color={C.lime} />
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: C.lineDark, marginVertical: 14 }} />

      <View style={{ gap: 8, marginBottom: 14 }}>
        {features.map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-circle" size={16} color={C.lime} />
            <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 13 }}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.9} onPress={() => url && Linking.openURL(url)}
        style={{ backgroundColor: C.lime, height: 48, borderRadius: R.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14 }}>{isFree ? "Passer à Pro" : "Gérer mon abonnement"}</Text>
        <Ionicons name="arrow-forward" size={15} color={C.ink} />
      </TouchableOpacity>
    </View>
  );
}
