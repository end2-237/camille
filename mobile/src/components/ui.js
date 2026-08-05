import React, { useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { C, R, S, SH, F, BOTTOM_INSET } from "../theme";

const TITLES = {
  dash: "Tableau\nde bord",
  agents: "Mes agents",
  convos: "Conversations",
  analytics: "Analytics",
  profile: "Profil",
  sav: "Réclamations",
};

/**
 * Voile dégradé posé sur une photo.
 *
 * Poser un aplat noir semi-transparent assombrit AUSSI le haut de l'image, là
 * où il n'y a pas de texte à protéger. Un dégradé n'assombrit que le bas : la
 * photo reste une photo, et le texte reste lisible.
 */
export function Scrim({ height = 200, to = "rgba(6,6,10,0.88)", from = "rgba(6,6,10,0)" }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height }} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sc)" />
      </Svg>
    </View>
  );
}

/**
 * Surface de verre.
 *
 * Trois couches : le fond translucide, le liseré clair sur l'arête haute, et
 * l'ombre large. Le liseré est une vue de 1 point posée en haut plutôt qu'un
 * `borderTopWidth` : une bordure suivrait le rayon des quatre coins et le trait
 * de lumière ferait le tour de la carte, ce qu'aucune lumière ne fait.
 */
export function Glass({ children, style, dark = false, radius = R.lg, shadow = SH.card }) {
  return (
    <View
      style={[
        {
          backgroundColor: dark ? C.glassDark : C.glass,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: dark ? "rgba(255,255,255,0.07)" : C.glassEdge,
          overflow: "hidden",
        },
        shadow,
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute", top: 0, left: radius * 0.5, right: radius * 0.5, height: 1,
          backgroundColor: dark ? C.glassDarkLine : C.glassLine,
        }}
      />
      {children}
    </View>
  );
}

/** Bouton rond de la barre haute. */
function RoundButton({ icon, onPress, badge = 0, dark = false, children }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        {
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: dark ? C.ink : C.white,
          borderWidth: 1, borderColor: dark ? "transparent" : C.line,
          alignItems: "center", justifyContent: "center",
        },
        SH.soft,
      ]}
    >
      {children || <Ionicons name={icon} size={19} color={dark ? C.lime : C.ink} />}
      {badge > 0 && (
        <View style={{
          position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
          paddingHorizontal: 4, backgroundColor: C.red, alignItems: "center", justifyContent: "center",
          borderWidth: 2, borderColor: C.bg,
        }}>
          <Text style={{ color: C.white, fontSize: 9.5, fontWeight: "800" }}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Barre haute : salutation à gauche, actions rondes à droite.
 *
 * La recherche n'y est plus. Elle y tenait dans 130 points de large — on ne
 * lisait jamais ce qu'on tapait. Elle descend sous le titre, pleine largeur.
 */
export function Header({ user, onProfile, onNotifications, unread = 0, initials }) {
  const prenom = String(user?.full_name || user?.email || "").split(/[\s@.]+/)[0] || "";
  const joli = prenom ? prenom.charAt(0).toUpperCase() + prenom.slice(1) : "";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: S.md, paddingTop: 6, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.sub, fontSize: 13.5 }}>
          {joli ? `Salut, ${joli} 👋` : "Bienvenue 👋"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
          <Text style={{ color: C.ink, fontSize: 12.5, fontWeight: "600" }}>Camille est en service</Text>
        </View>
      </View>

      <RoundButton icon={unread > 0 ? "notifications" : "notifications-outline"} onPress={onNotifications} badge={unread} />
      <RoundButton onPress={onProfile} dark>
        <Text style={{ color: C.lime, fontWeight: "800", fontSize: 13.5 }}>{initials || "👤"}</Text>
      </RoundButton>
    </View>
  );
}

/** Grand titre + barre de recherche pleine largeur. */
export function ScreenTitle({ tab, query, setQuery, showSearch = false }) {
  const titre = TITLES[tab] || "";
  return (
    <View style={{ paddingHorizontal: S.md, marginTop: 14 }}>
      <Text style={F.large}>{titre}</Text>

      {showSearch && (
        <Glass style={{ marginTop: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 48 }}
          radius={R.pill} shadow={SH.soft}>
          <Ionicons name="search" size={17} color={C.sub} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un agent, un client…"
            placeholderTextColor={C.sub}
            style={{ marginLeft: 9, flex: 1, fontSize: 14.5, color: C.ink }}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={17} color={C.sub} />
            </TouchableOpacity>
          ) : null}
        </Glass>
      )}
    </View>
  );
}

/** Pastille de filtre : pleine quand active, contour clair sinon. */
export function Pill({ label, icon, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={[{
        flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 15,
        borderRadius: R.pill,
        backgroundColor: active ? C.ink : C.white,
        borderWidth: 1, borderColor: active ? C.ink : C.line,
      }, active ? SH.soft : null]}>
      {icon ? <Ionicons name={icon} size={14} color={active ? C.lime : C.sub} /> : null}
      <Text style={{ color: active ? C.white : C.ink, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Card({ children, style, dark = true }) {
  if (!dark) {
    return <Glass style={[{ padding: S.md }, style]}>{children}</Glass>;
  }
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: R.lg, padding: S.md, overflow: "hidden" }, SH.card, style]}>
      <View pointerEvents="none" style={{
        position: "absolute", top: 0, left: R.lg * 0.5, right: R.lg * 0.5, height: 1,
        backgroundColor: C.glassDarkLine,
      }} />
      {children}
    </View>
  );
}

const NAV = [
  { key: "dash", icon: "grid" },
  { key: "agents", icon: "cube-outline" },
  { key: "convos", icon: "chatbubble-outline" },
  { key: "sav", icon: "alert-circle-outline" },
  { key: "analytics", icon: "stats-chart" },
  { key: "profile", icon: "person-outline" },
];

const NAV_ITEM = 46;
const NAV_GAP = 3;
const NAV_PAD = 6;

/**
 * Barre d'onglets flottante.
 *
 * La pastille active est un calque unique qui GLISSE d'un onglet à l'autre au
 * lieu de s'allumer et s'éteindre. Le mouvement dit d'où l'on vient — c'est ce
 * qui distingue une barre d'onglets qui a l'air vivante d'une rangée de boutons.
 */
export function BottomNav({ tab, setTab, savCount = 0 }) {
  const idx = Math.max(0, NAV.findIndex((n) => n.key === tab));
  const x = useRef(new Animated.Value(idx * (NAV_ITEM + NAV_GAP))).current;

  useEffect(() => {
    Animated.spring(x, {
      toValue: idx * (NAV_ITEM + NAV_GAP),
      useNativeDriver: true,
      friction: 11,
      tension: 90,
    }).start();
  }, [idx, x]);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 14 + BOTTOM_INSET }}
      pointerEvents="box-none">
      <View style={[{
        flexDirection: "row", backgroundColor: C.glassDark, borderRadius: R.pill,
        padding: NAV_PAD, gap: NAV_GAP,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
      }, SH.float]}>
        <View pointerEvents="none" style={{
          position: "absolute", top: 0, left: 30, right: 30, height: 1, backgroundColor: C.glassDarkLine,
        }} />

        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", top: NAV_PAD, left: NAV_PAD,
            width: NAV_ITEM, height: 44, borderRadius: R.pill,
            backgroundColor: C.lime,
            transform: [{ translateX: x }],
          }}
        />

        {NAV.map((it) => {
          const on = tab === it.key;
          const badge = it.key === "sav" ? savCount : 0;
          return (
            <TouchableOpacity key={it.key} onPress={() => setTab(it.key)} activeOpacity={0.7}
              style={{ width: NAV_ITEM, height: 44, borderRadius: R.pill, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={it.icon} size={20} color={on ? C.ink : "rgba(255,255,255,0.62)"} />
              {badge > 0 && (
                <View style={{
                  position: "absolute", top: 3, right: 5, minWidth: 16, height: 16, borderRadius: 8,
                  paddingHorizontal: 4, backgroundColor: C.red, alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: C.white, fontSize: 9.5, fontWeight: "800" }}>{badge > 9 ? "9+" : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Tuile de chiffre : verre clair, ou creux sombre à l'intérieur d'une carte. */
export function StatMini({ label, value, sub, dark }) {
  if (dark) {
    return (
      <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: R.md, padding: 13, flex: 1 }}>
        <Text style={{ fontSize: 11.5, color: C.subDark }}>{label}</Text>
        <Text style={{ fontSize: 19, fontWeight: "800", color: C.white, marginTop: 4, letterSpacing: -0.4 }}>{value}</Text>
        {sub ? <Text style={{ fontSize: 10.5, color: C.green, marginTop: 2 }}>{sub}</Text> : null}
      </View>
    );
  }
  return (
    <Glass style={{ padding: 14, flex: 1 }} radius={R.md} shadow={SH.soft}>
      <Text style={{ fontSize: 11.5, color: C.sub }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink, marginTop: 4, letterSpacing: -0.5 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10.5, color: C.green, marginTop: 2 }}>{sub}</Text> : null}
    </Glass>
  );
}

/** Titre de section, avec une action facultative à droite. */
export function SectionTitle({ children, action, onAction }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: C.ink, letterSpacing: -0.4 }}>{children}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 13, color: C.sub, fontWeight: "600" }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmptyHint({ text }) {
  return (
    <View style={{ alignItems: "center", marginTop: 28, paddingHorizontal: 30 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgDeep, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="sparkles-outline" size={19} color={C.sub} />
      </View>
      <Text style={{ color: C.sub, textAlign: "center", marginTop: 12, fontSize: 13.5, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}
