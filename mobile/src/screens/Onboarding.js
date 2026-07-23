import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R } from "../theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    emoji: "🤖",
    chip: "Vendeur IA, 24/7",
    title: "Vos agents IA\nvendent pour vous",
    body: "Camille répond à vos clients sur WhatsApp, présente vos produits et convertit — jour et nuit.",
    accent: "#C6F24E",
  },
  {
    emoji: "📊",
    chip: "Tout en un coup d'œil",
    title: "Suivez la\nperformance en direct",
    body: "Messages, contacts, leads et taux de conversion de chaque agent, en temps réel.",
    accent: "#7FB2FF",
  },
  {
    emoji: "💬",
    chip: "Ne ratez aucun lead",
    title: "Gardez le contrôle\ndes conversations",
    body: "Chaque échange suivi et qualifié. Reprenez la main quand vous voulez.",
    accent: "#F0A6FF",
  },
];

export default function Onboarding({ onDone }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const last = idx === SLIDES.length - 1;

  function go(next) {
    if (next >= SLIDES.length) return onDone();
    ref.current?.scrollTo({ x: next * width, animated: true });
    setIdx(next);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width, flex: 1, paddingHorizontal: 26, paddingTop: 70 }}>
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 150, height: 150, borderRadius: 44, backgroundColor: s.accent, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 78 }}>{s.emoji}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 26, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 14, height: 34, borderWidth: 1, borderColor: C.line }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.ink }} />
                <Text style={{ color: C.ink, fontWeight: "600", fontSize: 13 }}>{s.chip}</Text>
              </View>
            </View>

            <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 20 }}>
              <Text style={{ fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -0.6, lineHeight: 36 }}>{s.title}</Text>
              <Text style={{ fontSize: 15, color: C.sub, marginTop: 12, lineHeight: 22 }}>{s.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 26, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {SLIDES.map((_, i) => (
              <View key={i} style={{ height: 7, borderRadius: 4, width: i === idx ? 22 : 7, backgroundColor: i === idx ? C.ink : "rgba(0,0,0,0.18)" }} />
            ))}
          </View>
          {!last ? (
            <TouchableOpacity onPress={onDone}><Text style={{ color: C.sub, fontSize: 14, fontWeight: "600" }}>Passer</Text></TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <TouchableOpacity onPress={() => go(idx + 1)}
          style={{ backgroundColor: C.ink, height: 56, borderRadius: R.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>{last ? "Commencer" : "Suivant"}</Text>
          <Ionicons name="arrow-forward" size={18} color={C.lime} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
