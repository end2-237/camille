import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { Pill } from "../components/ui";

const TABS = [
  { key: "active", label: "En cours" },
  { key: "leads", label: "Leads" },
  { key: "done", label: "Terminées" },
];

// Ecran "Orders" -> suivi des conversations / leads traités par les agents.
export default function Conversations({ stats }) {
  const [tab, setTab] = useState("active");
  const agents = stats?.agents || [];
  const ov = stats?.overview || {};

  // Construit des "cartes de suivi" à partir des agents (ou démo).
  const base = agents.length ? agents : DEMO;
  const total = ov.total_messages || 264;

  const counts = {
    active: base.length,
    leads: ov.total_leads || 53,
    done: ov.unique_contacts || 56,
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.ink, letterSpacing: -0.5 }}>Conversations</Text>
            <View style={{ backgroundColor: C.ink, borderRadius: R.pill, paddingHorizontal: 8, height: 22, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.white, fontSize: 11, fontWeight: "700" }}>{total}</Text>
            </View>
          </View>
          <TouchableOpacity style={{ width: 34, height: 34, borderRadius: R.pill, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="swap-vertical" size={16} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Onglets */}
        <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: R.pill, padding: 4, marginBottom: 16 }}>
          {TABS.map((t) => (
            <View key={t.key} style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>
              <TouchableOpacity onPress={() => setTab(t.key)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 34,
                  borderRadius: R.pill, backgroundColor: tab === t.key ? C.ink : "transparent" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: tab === t.key ? C.white : C.sub }}>{t.label}</Text>
                <View style={{ backgroundColor: tab === t.key ? C.lime : "#EEE", borderRadius: R.pill, paddingHorizontal: 6, minWidth: 18, height: 16, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: C.ink }}>{counts[t.key]}</Text>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {base.map((a, i) => (
          <ConvCard key={a.agent_id || i} idx={i} agent={a} tab={tab} />
        ))}
      </ScrollView>
    </View>
  );
}

function ConvCard({ agent, idx, tab }) {
  const statusMap = {
    active: { label: "En transit", color: C.green, icon: "ellipse" },
    leads: { label: "Lead qualifié", color: C.amber, icon: "flag" },
    done: { label: "Clôturée", color: C.sub, icon: "checkmark-circle" },
  };
  const st = statusMap[tab];
  const id = "#" + (875412903 + idx * 137).toString().slice(0, 9);
  return (
    <View style={{ backgroundColor: C.white, borderRadius: R.lg, padding: S.md, marginBottom: 12, borderWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.sub, fontSize: 10 }}>Conversation</Text>
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15 }}>{id}</Text>
        </View>
        <View>
          <Text style={{ color: C.sub, fontSize: 10 }}>Agent assigné</Text>
          <Text style={{ color: C.ink, fontWeight: "700", fontSize: 13, textAlign: "right" }}>{agent.name || "Agent Camille"}</Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: C.line, marginVertical: 12 }} />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Row icon="location-outline" label="Canal" val="WhatsApp" />
          <Row icon="cube-outline" label="Secteur" val={agent.sector || agent.business_name || "E-commerce"} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <Text style={{ color: C.sub, fontSize: 11 }}>Statut</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name={st.icon} size={9} color={st.color} />
              <Text style={{ color: st.color, fontSize: 12, fontWeight: "600" }}>{st.label}</Text>
            </View>
          </View>
          <Text style={{ color: C.sub, fontSize: 10, marginTop: 8 }}>Dernier message</Text>
          <Text style={{ color: C.ink, fontSize: 12, fontWeight: "600" }}>Aujourd'hui</Text>
        </View>
        <View style={{ width: 70, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F5", borderRadius: R.md }}>
          <Ionicons name="chatbubble-ellipses" size={26} color={C.ink} />
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 16, marginTop: 4 }}>{agent.messages ?? (12 + idx * 3)}</Text>
          <Text style={{ color: C.sub, fontSize: 9 }}>msgs</Text>
        </View>
      </View>

      <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <Text style={{ color: C.ink, fontWeight: "600", fontSize: 13 }}>Voir plus</Text>
        <Ionicons name="ellipsis-horizontal" size={18} color={C.sub} />
      </TouchableOpacity>
    </View>
  );
}

function Row({ icon, label, val }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: C.sub, fontSize: 11 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name={icon} size={12} color={C.ink} />
        <Text style={{ color: C.ink, fontSize: 12, fontWeight: "600" }}>{val}</Text>
      </View>
    </View>
  );
}

const DEMO = [
  { name: "Clara Jensen", sector: "Mode", messages: 42 },
  { name: "Michael Torres", sector: "Électronique", messages: 31 },
  { name: "Awa Ndiaye", sector: "Beauté", messages: 27 },
];
