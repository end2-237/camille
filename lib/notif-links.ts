// ─────────────────────────────────────────────────────────────────────────────
// Destination d'une notification, déduite de son `data.type`.
//
// Partagé entre le panneau in-app (hooks/useNotifications) et le push web
// (lib/fcm, qui pose le lien d'ouverture dans le message FCM). Deux copies de
// cette table divergeraient au premier type ajouté — et le symptôme serait
// qu'un clic depuis la cloche et un clic depuis la notification système
// n'emmènent pas au même endroit.
// ─────────────────────────────────────────────────────────────────────────────

/** `null` quand rien de pertinent n'existe : la notification reste lisible, pas cliquable. */
export function lienNotif(data: Record<string, unknown> | null | undefined): string | null {
  const d = data ?? {};
  const agentId = String(d.agentId ?? "").trim();
  switch (String(d.type ?? "")) {
    case "order":                 return "/dashboard/orders";
    case "stock":                 return agentId ? `/dashboard/${agentId}/catalog` : null;
    // Vente manquée : le vendeur veut d'abord voir QUI a commandé, pour le
    // rappeler. Le réapprovisionnement vient après.
    case "rupture":               return "/dashboard/orders";
    case "quota":
    case "subscription":          return "/dashboard/billing";
    case "whatsapp_disconnected":
    case "whatsapp_connected":    return agentId ? `/dashboard/${agentId}/integrations` : null;
    default:                      return null;
  }
}
