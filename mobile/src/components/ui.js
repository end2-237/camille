import React from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S, F } from "../theme";

export function Header({ onSearch }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: S.md, paddingTop: 8, gap: 10 }}>
      <TouchableOpacity style={circle()}>
        <Ionicons name="notifications-outline" size={18} color={C.ink} />
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.lime, fontWeight: "900", fontSize: 13 }}>C</Text>
        </View>
        <Text style={{ fontWeight: "800", fontSize: 17, color: C.ink, letterSpacing: -0.3 }}>Camille</Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 12, height: 38, flex: 1, maxWidth: 150 }}>
        <Ionicons name="search" size={15} color={C.sub} />
        <TextInput placeholder="Rechercher…" placeholderTextColor={C.sub} onChangeText={onSearch}
          style={{ marginLeft: 6, flex: 1, fontSize: 13, color: C.ink }} />
      </View>
      <View style={{ width: 38, height: 38, borderRadius: R.pill, backgroundColor: "#C9B79C", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="person" size={18} color={C.white} />
      </View>
    </View>
  );
}

function circle() {
  return { width: 38, height: 38, borderRadius: R.pill, backgroundColor: C.white, alignItems: "center", justifyContent: "center" };
}

export function Card({ children, style, dark = true }) {
  return (
    <View style={[{ backgroundColor: dark ? C.card : C.white, borderRadius: R.lg, padding: S.md }, style]}>
      {children}
    </View>
  );
}

export function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress}
      style={{ paddingHorizontal: 14, height: 34, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
        backgroundColor: active ? C.ink : "transparent" }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: active ? C.white : C.sub }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function BottomNav({ tab, setTab }) {
  const items = [
    { key: "dash", icon: "grid" },
    { key: "agents", icon: "cube-outline" },
    { key: "convos", icon: "chatbubble-outline" },
    { key: "billing", icon: "card-outline" },
    { key: "stats", icon: "stats-chart" },
  ];
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 22 }}>
      <View style={{ flexDirection: "row", backgroundColor: C.ink, borderRadius: R.pill, padding: 6, gap: 4 }}>
        {items.map((it) => {
          const on = tab === it.key;
          return (
            <TouchableOpacity key={it.key} onPress={() => setTab(it.key)}
              style={{ width: 52, height: 44, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
                backgroundColor: on ? C.lime : "transparent" }}>
              <Ionicons name={it.icon} size={20} color={on ? C.ink : "rgba(255,255,255,0.6)"} />
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
