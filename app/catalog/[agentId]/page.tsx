"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ProductCard, type Product } from "@/components/catalog/ProductCard";

interface Shop { id: string; name: string; description?: string; website_url?: string | null; }

export default function PublicCatalogPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [shop, setShop]         = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState]       = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/catalog/${agentId}`);
        if (!r.ok) { setState("notfound"); return; }
        const d = await r.json();
        setShop(d.shop); setProducts(d.products ?? []); setState("ready");
      } catch { setState("notfound"); }
    })();
  }, [agentId]);

  if (state === "loading") {
    return <div className="cl-landing flex min-h-dvh items-center justify-center text-[14px]" style={{ color: "var(--cl-ink-faint)" }}>Chargement du catalogue…</div>;
  }
  if (state === "notfound") {
    return (
      <div className="cl-landing flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[18px] font-semibold" style={{ color: "var(--cl-ink)" }}>Catalogue introuvable</p>
        <p className="text-[14px]" style={{ color: "var(--cl-ink-soft)" }}>Ce lien n&apos;est plus disponible.</p>
      </div>
    );
  }

  return (
    <div className="cl-landing min-h-dvh">
      {/* En-tête boutique */}
      <header className="border-b" style={{ borderColor: "var(--cl-line)", background: "#fff" }}>
        <div className="cl-container flex flex-wrap items-center justify-between gap-4 py-7">
          <div>
            <h1 className="cl-h3" style={{ fontSize: 26 }}>{shop?.name}</h1>
            {shop?.description && (
              <p className="mt-1 max-w-[60ch] text-[14px]" style={{ color: "var(--cl-ink-soft)" }}>{shop.description}</p>
            )}
          </div>
          {shop?.website_url && (
            <a
              href={shop.website_url} target="_blank" rel="noopener noreferrer"
              className="cl-btn-black !px-4 !py-2 text-[13px]"
            >
              Visiter le site <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </header>

      {/* Grille */}
      <main className="cl-container py-8">
        <p className="mb-5 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--cl-ink-faint)" }}>
          {products.length} produit{products.length > 1 ? "s" : ""}
        </p>
        {products.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--cl-ink-soft)" }}>Ce catalogue est encore vide.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                footer={
                  shop?.website_url ? (
                    <a
                      href={shop.website_url} target="_blank" rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white"
                      style={{ background: "#16141A" }}
                    >
                      Commander
                    </a>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </main>

      <footer className="cl-container py-8">
        <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
          Catalogue propulsé par <span style={{ fontFamily: "var(--font-good-timing)", color: "var(--cl-accent-deep)" }}>Camille</span>
        </p>
      </footer>
    </div>
  );
}
