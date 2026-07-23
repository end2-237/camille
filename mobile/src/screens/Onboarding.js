import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R } from "../theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    accent: "#C6F24E",
    center: "🤖",
    badges: ["💬", "🛍️", "⚡", "🌙", "✅", "📲"],
    chip: "Vendeur IA · 24h/24",
    title: "Vos agents IA\nvendent pour vous",
    body: "Camille répond à vos clients sur WhatsApp, présente vos produits et conclut — même la nuit.",
    points: ["Réponses instantanées", "Catalogue intégré", "Jamais fatigué"],
  },
  {
    accent: "#7FB2FF",
    center: "📊",
    badges: ["📈", "👥", "🎯", "💡", "🔔", "⏱️"],
    chip: "Tout en un coup d'œil",
    title: "Suivez la\nperformance en direct",
    body: "Messages, contacts, leads et taux de conversion de chaque agent, mis à jour en temps réel.",
    points: ["Stats en direct", "Par agent", "Historique 30 j"],
  },
  {
    accent: "#F0A6FF",
    center: "💬",
    badges: ["✅", "🚩", "🕐", "📌", "🙌", "🔥"],
    chip: "Ne ratez aucun lead",
    title: "Gardez le contrôle\ndes conversations",
    body: "Chaque échange suivi et qualifié. Reprenez la main quand vous le souhaitez.",
    points: ["Suivi complet", "Leads qualifiés", "Reprise manuelle"],
  },
];

const POS = [
  { top: 6, left: 10 }, { top: 0, right: 20 }, { top: 70, left: -6 },
  { top: 66, right: -8 }, { bottom: 6, left: 26 }, { bottom: 0, right: 30 },
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
          <View key={i} style={{ width, flex: 1, paddingHorizontal: 26, paddingTop: 64 }}>
            {/* Hero */}
            <View style={{ height: 250, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 210, height: 210 }}>
                <View style={{ position: "absolute", top: 30, left: 30, width: 150, height: 150, borderRadius: 46,
                  backgroundColor: s.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 74 }}>{s.center}</Text>
                </View>
                {s.badges.map((b, k) => (
                  <View key={k} style={[{ position: "absolute", width: 46, height: 46, borderRadius: 23, backgroundColor: C.white,
                    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line,
                    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, POS[k]]}>
                    <Text style={{ fontSize: 20 }}>{b}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Texte */}
            <View style={{ flex: 1, justifyContent: "flex-start" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
                backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 12, height: 32, borderWidth: 1, borderColor: C.line, marginBottom: 16 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink }} />
                <Text style={{ color: C.ink, fontWeight: "600", fontSize: 12 }}>{s.chip}</Text>
              </View>

              <Text style={{ fontSize: 29, fontWeight: "800", color: C.ink, letterSpacing: -0.6, lineHeight: 35 }}>{s.title}</Text>
              <Text style={{ fontSize: 15, color: C.sub, marginTop: 10, lineHeight: 22 }}>{s.body}</Text>

              <View style={{ marginTop: 18, gap: 10 }}>
                {s.points.map((p) => (
                  <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: s.accent, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="checkmark" size={13} color={C.ink} />
                    </View>
                    <Text style={{ color: C.ink, fontSize: 14 }}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={{ paddingHorizontal: 26, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {SLIDES.map((_, i) => (
              <View key={i} style={{ height: 7, borderRadius: 4, width: i === idx ? 22 : 7, backgroundColor: i === idx ? C.ink : "rgba(0,0,0,0.18)" }} />
            ))}
          </View>
          {!last ? (
            <TouchableOpacity onPress={onDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: C.sub, fontSize: 14, fontWeight: "600" }}>Passer</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 44 }} />}
        </View>

        <TouchableOpacity onPress={() => go(idx + 1)} activeOpacity={0.85}
          style={{ backgroundColor: C.ink, height: 56, borderRadius: R.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>{last ? "Commencer" : "Suivant"}</Text>
          <Ionicons name="arrow-forward" size={18} color={C.lime} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
