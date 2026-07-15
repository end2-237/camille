// components/catalog/ProductCard.tsx — carte produit (design réf. dropshipping)
// Réutilisée par le dashboard (gestion) et la page publique (lien unique).

import { Star, ImageIcon } from "lucide-react";

export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number | string | null;
  price_max?: number | string | null;
  currency?: string;
  category?: string | null;
  tags?: string[];
  stock?: number | null;
  min_order?: number | null;
  rating?: number | string | null;
  image_url?: string | null;
  active?: boolean;
}

function fmtPrice(p: Product): string {
  const cur = p.currency || "XAF";
  const a = p.price != null ? Number(p.price) : null;
  const b = p.price_max != null ? Number(p.price_max) : null;
  if (a == null) return "—";
  const n = (x: number) => x.toLocaleString("fr-FR");
  return b != null && b > a ? `${n(a)}–${n(b)} ${cur}` : `${n(a)} ${cur}`;
}

export function ProductCard({ product, footer }: { product: Product; footer?: React.ReactNode }) {
  const tags = Array.isArray(product.tags) ? product.tags : [];
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{ border: "1px solid var(--cl-line)", background: "#fff" }}
    >
      {/* Image */}
      <div
        className="flex items-center justify-center"
        style={{ background: "var(--cl-bg-soft)", aspectRatio: "16 / 11" }}
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="h-full w-full object-contain p-3" />
        ) : (
          <ImageIcon className="h-8 w-8" style={{ color: "var(--cl-ink-faint)" }} />
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        {/* Badge catégorie + note */}
        <div className="mb-2 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink-soft)" }}
          >
            {product.category || "Produit"}
          </span>
          {product.rating != null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--cl-ink)" }}>
              <Star className="h-3 w-3" style={{ color: "#F5A623", fill: "#F5A623" }} />
              {Number(product.rating).toFixed(1)}
            </span>
          )}
        </div>

        {/* Titre */}
        <h3
          className="text-[14px] font-semibold leading-snug"
          style={{ color: "var(--cl-ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {product.name}
        </h3>

        {/* Prix / Stock */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10.5px]" style={{ color: "var(--cl-ink-faint)" }}>Prix</p>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>{fmtPrice(product)}</p>
          </div>
          <div>
            <p className="text-[10.5px]" style={{ color: "var(--cl-ink-faint)" }}>
              {product.stock != null ? "Stock" : "Min. commande"}
            </p>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>
              {product.stock != null ? `${product.stock}` : `${product.min_order ?? 1} u.`}
            </p>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((t) => (
              <span key={t} className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink-faint)" }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Footer actions */}
        {footer && <div className="mt-auto pt-3.5">{footer}</div>}
      </div>
    </div>
  );
}
