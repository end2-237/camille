import React from "react";
import { View, Text } from "react-native";
import { C } from "../theme";

export default function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 84, height: 84, borderRadius: 24, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.lime, fontWeight: "900", fontSize: 46, letterSpacing: -1 }}>C</Text>
      </View>
      <Text style={{ marginTop: 18, fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.5 }}>Camille</Text>
      <Text style={{ marginTop: 6, fontSize: 13, color: C.sub }}>Suivi de vos agents IA</Text>
      <View style={{ position: "absolute", bottom: 40, flexDirection: "row", gap: 6 }}>
        <Dot i={0} /><Dot i={1} /><Dot i={2} />
      </View>
    </View>
  );
}

function Dot({ i }) {
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === 1 ? C.lime : "rgba(0,0,0,0.15)" }} />;
}
