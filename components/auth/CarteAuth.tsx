"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Une carte seule, centrée, aux couleurs de la page de connexion — pour les
// écrans « mot de passe oublié » et « nouveau mot de passe ».
// ─────────────────────────────────────────────────────────────────────────────

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function CarteAuth({ titre, sous, children }: { titre: string; sous: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ca flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Link href="/login" className="mb-7 flex items-center gap-3.5">
        <Image src="/icons/camille-192.png" alt="" width={40} height={40} className="rounded-xl" />
        <span className="leading-tight">
          <span className="block text-[20px] font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)", fontFamily: "var(--font-good-timing)" }}>Camille</span>
          <span className="block text-[11.5px] font-medium tracking-[0.14em]" style={{ color: "var(--cl-ink-soft)" }}>BY BUYTICLE</span>
        </span>
      </Link>
      <div className="ca-carte w-full max-w-[460px] rounded-2xl bg-white px-6 py-8 sm:px-9">
        <h1 className="text-[24px] font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>{titre}</h1>
        <div className="mt-1.5 text-[15px] leading-[1.5]" style={{ color: "var(--cl-ink-soft)" }}>{sous}</div>
        {children}
      </div>
      <Link href="/login" className="mt-6 text-[14px] font-medium hover:underline" style={{ color: "var(--cl-accent-deep)" }}>
        ← Retour à la connexion
      </Link>
      <style jsx global>{`
        .ca { background: linear-gradient(180deg, #FAF8FF 0%, #F5F1FF 100%); font-family: "Inter Variable", "Inter", system-ui, sans-serif; }
        .ca-carte { box-shadow: 0 1px 2px rgba(25,23,27,0.04), 0 18px 50px rgba(100,66,232,0.08); border: 1px solid var(--cl-line-soft); }
        .ca-input {
          width: 100%; height: 48px; border-radius: 8px; padding: 0 16px; font-size: 16px;
          color: var(--cl-ink); background: #fff; border: 1px solid #D9D5DF; outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .ca-input::placeholder { color: #8E88A0; }
        .ca-input:focus { border-color: var(--cl-accent); box-shadow: 0 0 0 3px rgba(124,90,248,0.14); }
        .ca-btn { height: 50px; font-size: 16px; box-shadow: 0 8px 22px rgba(100,66,232,0.28); }
      `}</style>
    </div>
  );
}

export function ChampAuth({ label, erreur, children }: { label: string; erreur?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</label>
      {children}
      {erreur && <p className="mt-1.5 text-[12px]" style={{ color: "#C2504B" }}>{erreur}</p>}
    </div>
  );
}

export function OeilAuth({ voir, onClick }: { voir: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md"
      style={{ color: "var(--cl-ink-soft)" }}>
      {voir ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}

export function BoutonAuth({ loading, disabled, children }: { loading: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="ca-btn flex w-full items-center justify-center gap-2 rounded-lg font-semibold text-white transition disabled:opacity-60"
      style={{ background: "var(--cl-accent-deep)" }}>
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}
