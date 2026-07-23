import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Dimensions, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R } from "../theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    img: require("../../assets/ob1.png"),
    chip: "Vendeur IA · 24h/24",
    title: "Vos agents IA\nvendent pour vous",
    body: "Camille répond à vos clients sur WhatsApp, présente vos produits et conclut — même la nuit.",
    points: ["Réponses instantanées", "Catalogue intégré", "Jamais fatigué"],
  },
  {
    img: require("../../assets/ob2.png"),
    chip: "Tout en un coup d'œil",
    title: "Suivez la\nperformance en direct",
    body: "Messages, contacts, leads et taux de conversion de chaque agent, mis à jour en temps réel.",
    points: ["Stats en direct", "Par agent", "Historique 30 j"],
  },
  {
    img: require("../../assets/ob3.png"),
    chip: "Ne ratez aucun lead",
    title: "Gardez le contrôle\ndes conversations",
    body: "Chaque échange suivi et qualifié. Reprenez la main quand vous le souhaitez.",
    points: ["Suivi complet", "Leads qualifiés", "Reprise manuelle"],
  },
];

export default function Onboarding({ onDone }) {
  const ref = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [idx, setIdx] = useState(0);
  const last = idx === SLIDES.length - 1;

  function go(next) {
    if (next >= SLIDES.length) return onDone();
    ref.current?.scrollTo({ x: next * width, animated: true });
    setIdx(next);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((s, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const imgTranslate = scrollX.interpolate({ inputRange, outputRange: [width * 0.25, 0, -width * 0.25], extrapolate: "clamp" });
          const imgScale = scrollX.interpolate({ inputRange, outputRange: [0.86, 1, 0.86], extrapolate: "clamp" });
          const textTranslate = scrollX.interpolate({ inputRange, outputRange: [60, 0, -60], extrapolate: "clamp" });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
          return (
            <View key={i} style={{ width, flex: 1, paddingHorizontal: 26, paddingTop: 54 }}>
              <Animated.View style={{ height: 290, alignItems: "center", justifyContent: "center", transform: [{ translateX: imgTranslate }, { scale: imgScale }] }}>
                <Image source={s.img} style={{ width: width - 40, height: 290 }} resizeMode="contain" />
              </Animated.View>

              <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: textTranslate }] }}>
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
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.lime, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark" size={13} color={C.ink} />
                      </View>
                      <Text style={{ color: C.ink, fontSize: 14 }}>{p}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: 26, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {SLIDES.map((_, i) => (
              <View key={i} style={{ height: 7, borderRadius: 4, width: i === idx ? 22 : 7,
                backgroundColor: C.ink, opacity: i === idx ? 1 : 0.2 }} />
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
