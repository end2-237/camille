// ─────────────────────────────────────────────────────────────────────────────
// Notifications push — Firebase Cloud Messaging via expo-notifications.
//
// On enregistre le jeton NATIF (getDevicePushTokenAsync), pas le jeton Expo :
// le serveur parle directement à FCM, sans passer par le service push d'Expo.
//
// Ce module touche à du code natif : il ne peut pas arriver par OTA, il faut
// une nouvelle installation de l'APK.
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { registerPushToken } from "./api";

// Notification reçue app ouverte : on l'affiche quand même (bannière + son).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Canaux Android : l'utilisateur peut couper les uns sans couper les autres.
async function setupChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("commandes", {
    name: "Nouvelles commandes",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#C6F24E",
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("alertes", {
    name: "Alertes agent",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#FBBF24",
  });
}

/**
 * Demande l'autorisation, récupère le jeton FCM et l'envoie au serveur.
 * Ne lève jamais : une erreur ici ne doit pas empêcher l'app de démarrer.
 * @returns {Promise<string|null>} le jeton, ou null si indisponible
 */
export async function registerForPush() {
  try {
    if (!Device.isDevice) return null; // pas de push sur émulateur

    await setupChannels();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const res = await Notifications.requestPermissionsAsync();
      status = res.status;
    }
    if (status !== "granted") return null;

    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token) return null;

    await registerPushToken(token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}

/**
 * Branche les deux écoutes : notification reçue app ouverte, et tap sur une
 * notification (app en arrière-plan ou fermée).
 * @param {(payload:object)=>void} onForeground  notification reçue, app ouverte
 * @param {(payload:object)=>void} onOpen        l'utilisateur a tapé dessus
 * @returns {()=>void} fonction de désinscription
 */
export function listenPush(onForeground, onOpen) {
  const recv = Notifications.addNotificationReceivedListener((n) => {
    onForeground?.(n?.request?.content?.data || {});
  });
  const tap = Notifications.addNotificationResponseReceivedListener((r) => {
    onOpen?.(r?.notification?.request?.content?.data || {});
  });
  return () => { recv.remove(); tap.remove(); };
}

/** Remet le compteur de l'icône à zéro. */
export async function clearBadge() {
  try { await Notifications.setBadgeCountAsync(0); } catch {}
}
