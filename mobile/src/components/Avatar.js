import React from "react";
import { View, Text } from "react-native";
import { C } from "../theme";

const PALETTE = ["#6C5CE7", "#00B894", "#0984E3", "#E17055", "#E84393", "#0EA5A5", "#8E44AD"];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  return Math.abs(h);
}

export function initialsOf(name) {
  const parts = String(name || "").split(/[\s—\-·]+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AG";
}

// Avatar monogramme professionnel — aucune emoji.
export default function Avatar({ name, size = 42, radius, style }) {
  const color = PALETTE[hash(String(name || "A")) % PALETTE.length];
  const r = radius != null ? radius : size * 0.3;
  return (
    <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: color, alignItems: "center", justifyContent: "center" }, style]}>
      <Text style={{ color: C.white, fontWeight: "800", fontSize: size * 0.38, letterSpacing: 0.3 }}>{initialsOf(name)}</Text>
    </View>
  );
}
