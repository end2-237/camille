"use client";

// L'accueil du tableau de bord : voir components/dashboard/Accueil.tsx.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Accueil } from "@/components/dashboard/Accueil";

export default function DashboardPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted && !isLoggedIn) router.replace("/login"); }, [isLoggedIn, mounted, router]);

  return <Accueil />;
}
