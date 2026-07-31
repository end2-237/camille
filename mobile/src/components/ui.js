import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";

const TITLES = {
  dash: "Tableau de bord",
  agents: "Agents",
  convos: "Conversations",
  analytics: "Analytics",
  profile: "Profil",
  sav: "Réclamations",
};

export function Header({ query, setQuery, onProfile, onNotifications, unread = 0, initials }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: S.md, paddingTop: 8, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.lime, fontWeight: "900", fontSize: 14 }}>C</Text>
        </View>
        <Text style={{ fontWeight: "800", fontSize: 17, color: C.ink, letterSpacing: -0.3 }}>Camille</Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 12, height: 38, flex: 1, maxWidth: 130 }}>
        <Ionicons name="search" size={15} color={C.sub} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher…"
          placeholderTextColor={C.sub}
          style={{ marginLeft: 6, flex: 1, fontSize: 13, color: C.ink }}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={15} color={C.sub} />
          </TouchableOpacity>
        ) : null}
      </View>
      {/* Cloche : plus lisible qu'un 6e onglet dans une barre deja pleine. */}
      <TouchableOpacity onPress={onNotifications}
        style={{ width: 38, height: 38, borderRadius: R.pill, backgroundColor: C.white,
          borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={unread > 0 ? "notifications" : "notifications-outline"} size={18} color={C.ink} />
        {unread > 0 && (
          <View style={{ position: "absolute", top: -2, right: -2, minWidth: 17, height: 17, borderRadius: 9,
            paddingHorizontal: 4, backgroundColor: C.red, alignItems: "center", justifyContent: "center",
            borderWidth: 1.5, borderColor: C.bg }}>
            <Text style={{ color: C.white, fontSize: 9.5, fontWeight: "800" }}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onProfile}
        style={{ width: 38, height: 38, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.lime, fontWeight: "800", fontSize: 13 }}>{initials || "👤"}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ScreenTitle({ tab }) {
  return (
    <Text style={{ paddingHorizontal: S.md, marginTop: 10, fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.4 }}>
      {TITLES[tab] || ""}
    </Text>
  );
}

export function Card({ children, style, dark = true }) {
  return (
    <View style={[{ backgroundColor: dark ? C.card : C.white, borderRadius: R.lg, padding: S.md }, style]}>
      {children}
    </View>
  );
}

export function BottomNav({ tab, setTab, savCount = 0 }) {
  const items = [
    { key: "dash", icon: "grid" },
    { key: "agents", icon: "cube-outline" },
    { key: "convos", icon: "chatbubble-outline" },
    { key: "sav", icon: "alert-circle-outline", badge: savCount },
    { key: "analytics", icon: "stats-chart" },
    { key: "profile", icon: "person-outline" },
  ];
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 22 }}>
      <View style={{ flexDirection: "row", backgroundColor: C.ink, borderRadius: R.pill, padding: 6, gap: 4 }}>
        {items.map((it) => {
          const on = tab === it.key;
          return (
            <TouchableOpacity key={it.key} onPress={() => setTab(it.key)} activeOpacity={0.7}
              style={{ width: 46, height: 44, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
                backgroundColor: on ? C.lime : "transparent" }}>
              <Ionicons name={it.icon} size={20} color={on ? C.ink : "rgba(255,255,255,0.6)"} />
              {it.badge > 0 && (
                <View style={{ position: "absolute", top: 4, right: 6, minWidth: 16, height: 16,
                  borderRadius: 8, paddingHorizontal: 4, backgroundColor: C.red,
                  alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.white, fontSize: 9.5, fontWeight: "800" }}>
                    {it.badge > 9 ? "9+" : it.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function StatMini({ label, value, sub, dark }) {
  return (
    <View style={{ backgroundColor: dark ? C.chipDark : "#F4F4F4", borderRadius: R.md, padding: 12, flex: 1 }}>
      <Text style={{ fontSize: 11, color: dark ? C.subDark : C.sub }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: "800", color: dark ? C.white : C.ink, marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10, color: C.green, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

export function EmptyHint({ text }) {
  return <Text style={{ color: C.sub, textAlign: "center", marginTop: 24, fontSize: 13 }}>{text}</Text>;
}
