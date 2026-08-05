// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — deux écrans, pas plus.
//
// Il y en avait trois, et le troisième expliquait une fonctionnalité qu'on
// découvre de toute façon en cinq secondes dans l'app. Un onboarding ne sert
// pas à former : il sert à donner envie d'aller plus loin, et chaque écran
// supplémentaire perd du monde. On garde donc la promesse (écran 1) et la
// preuve (écran 2).
//
// L'écran 1 est plein cadre : la photo va bord à bord, sous la barre d'état,
// et le texte se pose dessus. C'est ce qui donne la sensation d'immersion —
// aucune marge blanche ne vient rappeler qu'on est dans un cadre.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from "react";
import {
  View, Text, Animated, Dimensions, ImageBackground, StatusBar, Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, SH, BOTTOM_INSET } from "../theme";
import { Scrim, Glass } from "../components/ui";
import { Press, Reveal, Halo } from "../components/motion";

const { width, height } = Dimensions.get("window");

const ATOUTS = [
  {
    icon: "chatbubbles",
    titre: "Elle répond à ta place",
    texte: "Jour et nuit, sur WhatsApp. Elle présente tes produits, répond aux prix et conclut.",
  },
  {
    icon: "receipt",
    titre: "Tes commandes se rangent seules",
    texte: "Chaque vente devient une commande, avec son bon à ton nom et à tes couleurs.",
  },
  {
    icon: "pulse",
    titre: "Tu vois tout d'un coup d'œil",
    texte: "Messages, clients, chiffre d'affaires. Sans ouvrir un ordinateur.",
  },
];

export default function Onboarding({ onDone }) {
  const ref = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [idx, setIdx] = useState(0);

  function aller(n) {
    if (n >= 2) return onDone();
    ref.current?.scrollTo({ x: n * width, animated: true });
    setIdx(n);
  }

  // La photo se déplace moins vite que l'écran : le décalage crée la
  // profondeur. Sans lui, deux écrans glissent ; avec lui, un seul monde bouge.
  const photoX = scrollX.interpolate({
    inputRange: [0, width],
    outputRange: [0, -width * 0.35],
    extrapolate: "clamp",
  });
  const photoOpacite = scrollX.interpolate({
    inputRange: [0, width * 0.85],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const texteX = scrollX.interpolate({
    inputRange: [0, width],
    outputRange: [0, -width * 0.75],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: idx === 0 ? "#0A0A0C" : C.bg }}>
      <StatusBar
        barStyle={idx === 0 ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Décor : sous les deux écrans, il ne défile pas au même rythme qu'eux. */}
      <Animated.View
        style={{
          position: "absolute", top: 0, left: 0, width, height,
          opacity: photoOpacite, transform: [{ translateX: photoX }],
        }}
        pointerEvents="none"
      >
        <ImageBackground source={require("../../assets/ob1-hero.png")} style={{ flex: 1 }} resizeMode="cover">
          <Scrim height={height * 0.72} to="rgba(6,6,10,0.94)" />
        </ImageBackground>
      </Animated.View>

      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {/* ── 1. La promesse ─────────────────────────────────────────────── */}
        <View style={{ width, height }}>
          <Animated.View
            style={{
              flex: 1, paddingHorizontal: 26,
              paddingTop: (StatusBar.currentHeight || 44) + 16,
              paddingBottom: 34 + BOTTOM_INSET,
              transform: [{ translateX: texteX }],
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 3.5 }}>CAMILLE</Text>
              <View style={{ flex: 1 }} />
              <Press onPress={onDone} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 14, fontWeight: "600" }}>Passer</Text>
              </Press>
            </View>

            <View style={{ flex: 1 }} />

            <Reveal index={0} dy={26} duree={620}>
              <View style={{
                alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7,
                backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
                borderRadius: R.pill, paddingHorizontal: 13, height: 32, marginBottom: 18,
              }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.lime }} />
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Vendeur WhatsApp automatique</Text>
              </View>
            </Reveal>

            <Reveal index={1} dy={30} duree={640}>
              <Text style={{ color: "#fff", fontSize: 44, lineHeight: 47, fontWeight: "800", letterSpacing: -1.6 }}>
                Vends même{"\n"}quand tu dors.
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", fontSize: 15.5, lineHeight: 23, marginTop: 16, width: "88%" }}>
                Camille répond à tes clients sur WhatsApp, présente ton catalogue
                et enregistre les commandes. Toi, tu livres.
              </Text>
            </Reveal>

            {/* Le bouton d'entrée. Repris tel quel de la maquette : une capsule
                de verre, une flèche qui indique le geste possible (glisser),
                et le rond d'action dessous. Les deux mènent au même endroit —
                on ne punit pas celui qui n'a pas deviné le glissement. */}
            <Reveal index={2} dy={34} duree={680} style={{ marginTop: 34 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Glass
                  dark
                  radius={R.pill}
                  shadow={SH.float}
                  // `overflow: visible` : sans ça, la capsule rognerait le halo
                  // qui pulse derrière le bouton, et il ne resterait qu'une
                  // bande verticale.
                  style={{ padding: 7, alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", overflow: "visible" }}
                >
                  <View style={{ height: 46, width: 62, alignItems: "center", justifyContent: "center" }}>
                    <FlecheQuiRespire />
                  </View>
                  <View style={{ alignItems: "center", justifyContent: "center" }}>
                    <Halo size={62} />
                    <Press onPress={() => aller(1)} scale={0.9}>
                      <View style={{
                        width: 62, height: 62, borderRadius: 31, backgroundColor: C.lime,
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}>Go</Text>
                      </View>
                    </Press>
                  </View>
                </Glass>

                <View style={{ flex: 1 }} />

                <View style={{ paddingBottom: 6 }}>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, textAlign: "right" }}>
                    Fait pour{"\n"}le Cameroun 🇨🇲
                  </Text>
                </View>
              </View>
            </Reveal>
          </Animated.View>
        </View>

        {/* ── 2. La preuve ───────────────────────────────────────────────── */}
        <View style={{ width, height, backgroundColor: C.bg }}>
          <View style={{
            flex: 1, paddingHorizontal: 24,
            paddingTop: (StatusBar.currentHeight || 44) + 40,
            paddingBottom: 30 + BOTTOM_INSET,
          }}>
            <Text style={{ color: C.sub, fontSize: 13, fontWeight: "600", letterSpacing: 1.4 }}>
              CE QUE TU OBTIENS
            </Text>
            <Text style={{ color: C.ink, fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -1.2, marginTop: 10 }}>
              Ta boutique{"\n"}tient dans ta poche.
            </Text>

            <View style={{ marginTop: 30, gap: 12 }}>
              {ATOUTS.map((a, i) => (
                <SurLeVif key={a.icon} actif={idx === 1} index={i}>
                  <Glass style={{ flexDirection: "row", gap: 14, padding: 16 }}>
                    <View style={{
                      width: 44, height: 44, borderRadius: 15, backgroundColor: C.ink,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Ionicons name={a.icon} size={20} color={C.lime} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.ink, fontSize: 15.5, fontWeight: "700", letterSpacing: -0.3 }}>{a.titre}</Text>
                      <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19, marginTop: 3 }}>{a.texte}</Text>
                    </View>
                  </Glass>
                </SurLeVif>
              ))}
            </View>

            <View style={{ flex: 1 }} />

            <Press onPress={onDone} scale={0.97}>
              <View style={[{
                backgroundColor: C.ink, height: 58, borderRadius: R.pill,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
              }, SH.card]}>
                <Text style={{ color: C.white, fontWeight: "700", fontSize: 15.5 }}>Commencer</Text>
                <Ionicons name="arrow-forward" size={18} color={C.lime} />
              </View>
            </Press>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Points de progression. Sur l'écran 1 ils sont clairs (fond sombre),
          sur l'écran 2 ils sont sombres (fond clair) : on les fait basculer
          plutôt que de choisir une couleur passe-partout illisible des deux
          côtés. */}
      <View style={{
        position: "absolute", bottom: 16 + BOTTOM_INSET, left: 0, right: 0,
        flexDirection: "row", justifyContent: "center", gap: 7,
      }} pointerEvents="none">
        {[0, 1].map((i) => (
          <View key={i} style={{
            height: 6, borderRadius: 3, width: i === idx ? 20 : 6,
            backgroundColor: idx === 0 ? "#fff" : C.ink,
            opacity: i === idx ? 0.95 : 0.28,
          }} />
        ))}
      </View>
    </View>
  );
}

/** Chevron qui monte et redescend : il montre le geste sans l'écrire. */
function FlecheQuiRespire() {
  const a = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [a]);

  return (
    <Animated.View style={{
      opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [4, -4] }) }],
    }}>
      <Ionicons name="chevron-up" size={22} color="#fff" />
    </Animated.View>
  );
}

/**
 * Apparition déclenchée à l'arrivée sur l'écran, pas au montage.
 *
 * Les deux écrans existent dès le départ dans le ScrollView : une cascade
 * lancée au montage aurait donc déjà été jouée, dans le vide, avant qu'on
 * arrive sur le second.
 */
function SurLeVif({ actif, index, children }) {
  const a = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!actif) return undefined;
    const t = Animated.timing(a, {
      toValue: 1,
      duration: 460,
      delay: index * 90,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [actif, a, index]);

  return (
    <Animated.View style={{
      opacity: a,
      transform: [
        { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
        { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
    }}>
      {children}
    </Animated.View>
  );
}
