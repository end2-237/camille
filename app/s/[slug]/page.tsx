import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { vitrineParSlug } from "@/lib/vitrine";
import { VitrineClient } from "@/components/vitrine/Vitrine";

// Toujours à jour : un prix ou un stock changé dans Camille se voit tout de suite.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await vitrineParSlug(slug);
  if (!v) return { title: "Boutique introuvable" };
  const description = v.accroche || v.description || `Commandez chez ${v.nom} en ligne, livraison ou retrait.`;
  return {
    title: v.nom,
    description,
    openGraph: { title: v.nom, description, images: v.logo ? [v.logo] : v.produits.find((p) => p.image)?.image ? [v.produits.find((p) => p.image)!.image!] : [] },
    icons: v.logo ? { icon: v.logo } : undefined,
  };
}

/** La vitrine en ligne d'un commerçant : son catalogue Camille, en direct. */
export default async function VitrinePage({ params }: Props) {
  const { slug } = await params;
  const v = await vitrineParSlug(slug);
  if (!v) notFound();
  return <VitrineClient v={v} />;
}
