import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image, TextInput, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, S } from "../theme";
import { wahaStatus, wahaConnect, wahaDisconnect, wahaPairingCode, getWahaQr, wahaQrSource } from "../api";

export default function ConnectWhatsApp({ agent, onClose }) {
  const [status, setStatus] = useState(null);      // {connected, status, phone_number, session_name}
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("qr");          // 'qr' | 'code'
  const [nonce, setNonce] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [attente, setAttente] = useState("");   // code pas encore prêt
  const [qr, setQr] = useState(null);           // image du QR, en data URL
  const [qrErreur, setQrErreur] = useState(""); // pourquoi il n'y en a pas
  const [ancienneVoie, setAncienneVoie] = useState(false); // serveur pas encore redéployé
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const poll = useRef(null);

  async function refresh() {
    try {
      const s = await wahaStatus(agent.agent_id);
      setStatus(s);
      if (s.session_name) setSession(s.session_name);
      return s;
    } catch { return null; }
  }

  // Le QR est récupéré en JSON : on veut pouvoir DIRE pourquoi il n'est pas là.
  useEffect(() => {
    if (!session || mode !== "qr" || status?.connected) return;
    let vivant = true;
    getWahaQr(session)
      .then((d) => {
        if (!vivant) return;
        // Un serveur pas encore redéployé ignore format=json et renvoie le PNG.
        // req() n'en tire rien d'exploitable : on repasse alors par l'image,
        // qui marchait avant. L'ordre des déploiements ne doit pas décider si
        // un vendeur peut connecter son WhatsApp.
        setQr(d.qr || null);
        setAncienneVoie(!d.qr);
        setQrErreur("");
      })
      .catch((e) => { if (vivant) { setQr(null); setAncienneVoie(false); setQrErreur(e.message || "QR indisponible"); } });
    return () => { vivant = false; };
  }, [session, nonce, mode, status?.connected]);

  useEffect(() => {
    (async () => { await refresh(); setLoading(false); })();
    poll.current = setInterval(async () => {
      const s = await refresh();
      if (s?.connected) { clearInterval(poll.current); setNonce((n) => n); }
      else setNonce((n) => n + 1); // rafraîchit le QR
    }, 5000);
    return () => poll.current && clearInterval(poll.current);
  }, [agent.agent_id]);

  const connected = status?.connected;

  // Une ligne en base ne veut PAS dire qu'une session tourne.
  //
  // /api/waha/status renvoie le nom de session dès qu'une ligne existe dans la
  // base, même quand camille-core, lui, n'a plus rien en mémoire — après une
  // réinitialisation, ou après un redémarrage qui n'a pas repris le dossier.
  // L'écran en concluait « session existante », affichait le panneau du QR, et
  // n'appelait donc JAMAIS le démarrage. Le core n'avait rien à montrer, et on
  // attendait devant un carré vide un QR que personne n'avait demandé.
  //
  // La vérité est dans l'état renvoyé par le core, pas dans l'existence du nom.
  const MORTS = ["STOPPED", "FAILED", "ERROR"];
  const aDemarrer = !session || MORTS.includes(String(status?.status || ""));

  async function startConnect() {
    setBusy(true);
    try {
      const r = await wahaConnect(agent.agent_id);
      if (r.session_name) setSession(r.session_name);
      setNonce((n) => n + 1);
      await refresh();
    } catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  }

  async function getCode() {
    if (!phone.trim()) { Alert.alert("Numéro requis", "Entre le numéro WhatsApp avec l'indicatif (ex: 2376…)."); return; }
    setBusy(true); setCode(""); setAttente("");
    try {
      const r = await wahaPairingCode(agent.agent_id, phone.trim());
      if (r.code) setCode(r.code);
      // Le serveur peut accepter le numéro sans avoir encore de code : le
      // socket WhatsApp finit de s'ouvrir. Sans ce message, l'écran ne montre
      // rien et on croit que ça a échoué.
      else setAttente(r.message || "Numéro enregistré. Le code arrive dans quelques secondes.");
    } catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try { await wahaDisconnect(agent.agent_id); await refresh(); }
    catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.md, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18 }}>Connexion WhatsApp</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line }}>
          <Ionicons name="close" size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: 4, paddingBottom: 30 }}>
        {loading ? (
          <ActivityIndicator color={C.ink} style={{ marginTop: 30 }} />
        ) : connected ? (
          <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md, alignItems: "center" }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#E4F8EC", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark-circle" size={40} color="#25D366" />
            </View>
            <Text style={{ color: C.ink, fontWeight: "800", fontSize: 17, marginTop: 12 }}>WhatsApp connecté</Text>
            <Text style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>{status?.phone_number || "Session active"}</Text>
            <TouchableOpacity onPress={disconnect} disabled={busy}
              style={{ marginTop: 18, height: 46, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
              {busy ? <ActivityIndicator color={C.red} /> : <><Ionicons name="log-out-outline" size={17} color={C.red} /><Text style={{ color: C.red, fontWeight: "700" }}>Déconnecter</Text></>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Sélecteur QR / Code */}
            <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: R.pill, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.line }}>
              {[["qr", "QR code"], ["code", "Code de couplage"]].map(([k, l]) => (
                <TouchableOpacity key={k} onPress={() => setMode(k)}
                  style={{ flex: 1, height: 36, borderRadius: R.pill, alignItems: "center", justifyContent: "center", backgroundColor: mode === k ? C.ink : "transparent" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: mode === k ? C.white : C.sub }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {aDemarrer ? (
              <TouchableOpacity onPress={startConnect} disabled={busy}
                style={{ height: 52, borderRadius: R.pill, backgroundColor: C.lime, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
                {busy ? <ActivityIndicator color={C.ink} /> : <><Ionicons name="qr-code-outline" size={18} color={C.ink} /><Text style={{ color: C.ink, fontWeight: "800" }}>Démarrer la connexion</Text></>}
              </TouchableOpacity>
            ) : mode === "qr" ? (
              <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md, alignItems: "center" }}>
                <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14, marginBottom: 4 }}>Scanne ce QR depuis WhatsApp</Text>
                <Text style={{ color: C.sub, fontSize: 12, textAlign: "center", marginBottom: 14 }}>WhatsApp → Appareils connectés → Connecter un appareil</Text>
                {qr ? (
                  <Image source={{ uri: qr }} style={{ width: 240, height: 240, borderRadius: 12, backgroundColor: "#F4F4F4" }} resizeMode="contain" />
                ) : ancienneVoie ? (
                  <Image key={nonce} source={wahaQrSource(session, String(nonce))}
                    style={{ width: 240, height: 240, borderRadius: 12, backgroundColor: "#F4F4F4" }} resizeMode="contain" />
                ) : (
                  <View style={{ width: 240, height: 240, borderRadius: 12, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    {qrErreur ? (
                      <>
                        <Ionicons name="alert-circle-outline" size={26} color={C.sub} />
                        <Text style={{ color: C.sub, fontSize: 12.5, textAlign: "center", marginTop: 8, lineHeight: 18 }}>{qrErreur}</Text>
                      </>
                    ) : (
                      <ActivityIndicator color={C.ink} />
                    )}
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
                  <ActivityIndicator size="small" color={C.sub} />
                  <Text style={{ color: C.sub, fontSize: 12 }}>
                    {qr ? "En attente du scan…" : "Nouvelle tentative toutes les 5 s…"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 18, marginTop: 10 }}>
                  <TouchableOpacity onPress={() => setNonce((n) => n + 1)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="refresh" size={14} color={C.ink} />
                    <Text style={{ color: C.ink, fontWeight: "600", fontSize: 12 }}>Rafraîchir le QR</Text>
                  </TouchableOpacity>
                  {/* Relancer reste accessible même quand l'écran croit la
                      session vivante : c'est la sortie quand le core, lui, ne
                      l'a plus. */}
                  <TouchableOpacity onPress={startConnect} disabled={busy} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="play-outline" size={14} color={C.ink} />
                    <Text style={{ color: C.ink, fontWeight: "600", fontSize: 12 }}>Relancer la session</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.md }}>
                <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }}>Connexion par numéro</Text>
                <Text style={{ color: C.sub, fontSize: 12, marginTop: 4, marginBottom: 12 }}>Reçois un code à saisir dans WhatsApp (Appareils connectés → Connecter → Utiliser le numéro).</Text>
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F4F4F4", borderRadius: R.md, paddingHorizontal: 14, height: 50 }}>
                  <Ionicons name="call-outline" size={18} color={C.sub} />
                  <TextInput value={phone} onChangeText={setPhone} placeholder="Ex: 2376XXXXXXXX" placeholderTextColor={C.sub}
                    keyboardType="phone-pad" style={{ flex: 1, marginLeft: 10, fontSize: 15, color: C.ink }} />
                </View>
                <TouchableOpacity onPress={getCode} disabled={busy}
                  style={{ marginTop: 12, height: 48, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                  {busy ? <ActivityIndicator color={C.lime} /> : <Text style={{ color: C.white, fontWeight: "700" }}>Recevoir le code</Text>}
                </TouchableOpacity>
                {attente && !code ? (
                  <Text style={{ color: C.sub, fontSize: 12.5, lineHeight: 18, marginTop: 12 }}>{attente}</Text>
                ) : null}
                {code ? (
                  <View style={{ marginTop: 16, alignItems: "center" }}>
                    <Text style={{ color: C.sub, fontSize: 12 }}>Ton code de couplage</Text>
                    <Text style={{ color: C.ink, fontWeight: "900", fontSize: 30, letterSpacing: 6, marginTop: 6 }}>{code}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
