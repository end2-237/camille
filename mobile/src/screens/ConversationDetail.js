import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import Avatar from "../components/Avatar";
import { getAgent } from "../api";

const WEB = "https://camille.vps.buyticle.com";

export default function ConversationDetail({ agent, stats, onClose }) {
  const [full, setFull] = useState(null);
  useEffect(() => {
    let on = true;
    getAgent(agent.agent_id).then((d) => on && setFull(d?.agent || d)).catch(() => {});
    return () => { on = false; };
  }, [agent.agent_id]);

  const online = (agent.status || "active") === "active";
  const bc = full?.business_context || {};
  const phone = bc.whatsapp_number;
  const totalMsg = (stats?.agents || []).reduce((s, a) => s + (a.messages || 0), 0) || 1;
  const share = Math.round(((agent.messages || 0) / totalMsg) * 100);

  return (
    <View style={{ flex: 1 }}>
      {/* Hero coloré */}
      <View style={{ backgroundColor: C.ink, paddingTop: 44, paddingHorizontal: S.md, paddingBottom: 22, borderBottomRightRadius: 26 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ color: C.subDark, fontSize: 12, fontWeight: "600", letterSpacing: 0.4 }}>PERFORMANCE AGENT</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={18} color={C.white} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={agent.name} size={58} radius={18} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 20, letterSpacing: -0.3 }}>{agent.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: online ? C.green : C.amber }} />
              <Text style={{ color: online ? C.green : C.amber, fontSize: 12, fontWeight: "700" }}>{online ? "En ligne" : "En pause"}</Text>
              <Text style={{ color: C.subDark, fontSize: 12 }}>· {agent.sector || bc.business_name || "WhatsApp"}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Stats individuelles */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <Stat label="Messages" value={agent.messages ?? 0} icon="chatbubble-ellipses-outline" />
          <Stat label="Part du volume" value={`${share}%`} icon="pie-chart-outline" />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: S.md }}>
          <Stat label="État" value={online ? "Actif" : "Pause"} icon="pulse-outline" />
          <Stat label="Canal" value="WhatsApp" icon="logo-whatsapp" />
        </View>

        {/* Connexion WhatsApp */}
        <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 8, marginLeft: 2 }}>CONNEXION WHATSAPP</Text>
        <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md, marginBottom: S.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: online ? "#E4F8EC" : "#FBEEE0", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="logo-whatsapp" size={24} color={online ? "#25D366" : C.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>{online ? "Session connectée" : "Session en pause"}</Text>
              <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{phone ? phone : "Numéro non renseigné"}</Text>
            </View>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: online ? C.green : C.amber }} />
          </View>
          <TouchableOpacity onPress={() => Linking.openURL(`${WEB}/dashboard/${agent.agent_id}/integrations`)}
            style={{ marginTop: 14, height: 44, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
            <Ionicons name="settings-outline" size={16} color={C.ink} />
            <Text style={{ color: C.ink, fontWeight: "700", fontSize: 13 }}>Gérer la connexion</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => Linking.openURL(`${WEB}/dashboard/${agent.agent_id}`)}
          style={{ height: 50, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Ionicons name="open-outline" size={17} color={C.ink} />
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14 }}>Ouvrir la conversation</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, icon }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 14 }}>
      <Ionicons name={icon} size={18} color={C.ink} />
      <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18, marginTop: 8 }}>{value}</Text>
      <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
