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
    // L'automatisation en panne se regarde au même endroit que la connexion :
    // c'est là que le vendeur voit l'état de sa liaison WhatsApp.
    case "automation_down":
    case "automation_up":         return agentId ? `/dashboard/${agentId}/integrations` : null;
    // Un client nommé attend. Il n'existe pas encore d'écran de conversation
    // sur le web : on ouvre la fiche de l'agent, d'où le vendeur voit l'état
    // et peut agir. Renvoyer vers une page inexistante serait pire que rien.
    case "automation_fallback":   return agentId ? `/dashboard/${agentId}` : null;
    // Incident WhatsApp touchant plusieurs comptes. On envoie quand même vers
    // la page de connexion de l'agent : le vendeur y verra l'état revenir au
    // vert de lui-même, ce qui vaut mieux qu'une alerte sur laquelle on ne
    // peut rien faire.
    case "platform_incident":     return agentId ? `/dashboard/${agentId}/integrations` : null;
    // Veille plateforme : réservée aux administrateurs, elle mène à la console
    // où le détail des versions est affiché.
    case "platform_update":       return "/dashboard/admin";
    default:                      return null;
  }
}
