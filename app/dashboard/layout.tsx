"use client";

// Le tableau de bord : une seule coquille pour toutes les pages — en-tête et
// menu du haut, feuille blanche, bouton pour changer d'agent.
// Voir components/dashboard/coquille/.

import { Coquille } from "@/components/dashboard/coquille/Coquille";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Coquille>{children}</Coquille>;
}
