import React from "react";
import { View, Text, TouchableOpacity, Linking, BackHandler, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";

// Écran de blocage : l'app est inutilisable tant qu'elle n'est pas mise à jour.
// Volontairement SANS bouton de fermeture, et le retour Android est neutralisé —
// c'est le principe même d'une mise à jour obligatoire.
export default function ForceUpdate({ info }) {
  React.useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const url = info?.download_url || "https://camille.vps.buyticle.com/app";

  return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", padding: 28 }}>
      <View style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: 110,
        backgroundColor: "rgba(198,242,78,0.08)" }} />

      <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: "rgba(198,242,78,0.14)",
        alignItems: "center", justifyContent: "center", marginBottom: 26 }}>
        <Ionicons name="cloud-download" size={40} color={C.lime} />
      </View>

      <Text style={{ color: C.white, fontWeight: "800", fontSize: 25, textAlign: "center", letterSpacing: -0.5 }}>
        Mise à jour requise
      </Text>

      <Text style={{ color: C.subDark, fontSize: 14.5, textAlign: "center", marginTop: 14, lineHeight: 21 }}>
        Cette version de Camille n&apos;est plus prise en charge. Installe la dernière
        version pour continuer à gérer tes agents et tes commandes.
      </Text>

      {info?.notes ? (
        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: R.md, padding: 14, marginTop: 20, width: "100%" }}>
          <Text style={{ color: C.white, fontSize: 13, lineHeight: 19 }}>{info.notes}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 22 }}>
        <Badge label={`Ta version ${info?.current || "?"}`} />
        <Badge label={`Requise ${info?.min_version || "?"}`} accent />
      </View>

      <TouchableOpacity onPress={() => Linking.openURL(url)} activeOpacity={0.9}
        style={{ height: 54, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center",
          justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 30, width: "100%" }}>
        <Ionicons name="download" size={19} color={C.ink} />
        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15.5 }}>Mettre à jour</Text>
      </TouchableOpacity>

      <Text style={{ color: C.subDark, fontSize: 11.5, marginTop: 16, textAlign: "center" }}>
        Une fois installée, rouvre l&apos;application.
      </Text>
    </View>
  );
}

function Badge({ label, accent }) {
  return (
    <View style={{ paddingHorizontal: 12, height: 26, borderRadius: R.pill, justifyContent: "center",
      backgroundColor: accent ? "rgba(198,242,78,0.16)" : "rgba(255,255,255,0.07)" }}>
      <Text style={{ color: accent ? C.lime : C.subDark, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
