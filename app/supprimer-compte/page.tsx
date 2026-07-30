// app/supprimer-compte/page.tsx
//
// Page publique de suppression de compte, exigée par Google Play pour toute
// application permettant d'en créer un. Elle doit être atteignable SANS
// installer l'app et SANS être connecté : c'est l'URL qu'on déclare dans la
// Play Console, et le relecteur la vérifie.
//
// Elle n'exécute rien elle-même — elle explique ce qui est effacé, où cliquer
// dans l'app, et donne un recours par e-mail pour qui n'a plus accès à l'app.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Supprimer mon compte — Camille by Buyticle",
  description:
    "Comment supprimer définitivement votre compte Camille et l'ensemble des données associées.",
};

const SUPPRIME = [
  "Votre compte et vos identifiants de connexion",
  "Vos agents WhatsApp et leur configuration",
  "Vos catalogues produits, images comprises",
  "Vos commandes, leur suivi et les coordonnées de livraison enregistrées",
  "Vos conversations et l'historique des messages traités",
  "Vos clés d'intégration API",
  "Vos jetons de notification et vos notifications",
];

const CONSERVE = [
  "Les messages déjà envoyés sur WhatsApp restent dans les conversations de vos clients : ils appartiennent à leur téléphone, hors de notre portée.",
  "Les pièces comptables liées à un paiement (factures) sont conservées le temps imposé par la loi commerciale camerounaise, puis détruites.",
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-6 space-y-4"
      style={{ background: "var(--bg-elevated, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle)" }}
    >
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
            style={{ background: "var(--color-gold)" }}
          />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-dvh" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <header
        className="sticky top-0 z-50 flex items-center gap-4 px-6 h-14"
        style={{
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link href="/" className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--color-gold)" }}>
          ✦ Camille
        </Link>
        <span className="flex-1" />
        <Link href="/privacy" className="text-xs hover:text-white transition-colors" style={{ color: "var(--text-disabled)" }}>
          Confidentialité
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 lg:py-20 space-y-10">
        <div className="space-y-4 pb-8" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: "rgba(124,90,248,0.08)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.2)" }}
          >
            Compte et données
          </div>
          <h1 className="text-3xl font-bold">Supprimer mon compte</h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Vous pouvez effacer votre compte Camille et toutes les données associées
            à tout moment, vous-même, sans passer par notre support. La suppression
            est immédiate et définitive : elle ne peut pas être annulée.
          </p>
        </div>

        <Card title="Depuis l'application Camille">
          <p>
            Ouvrez l&apos;application, puis&nbsp;:
          </p>
          <ol className="space-y-2 pl-5 list-decimal">
            <li>Touchez l&apos;icône de profil, en haut à droite</li>
            <li>
              Faites défiler jusqu&apos;à <strong style={{ color: "var(--text-primary)" }}>Supprimer mon compte</strong>
            </li>
            <li>Saisissez votre mot de passe et écrivez <code>SUPPRIMER</code> pour confirmer</li>
          </ol>
          <p>
            Ces deux confirmations sont volontaires : la première prouve que c&apos;est
            bien vous, la seconde que c&apos;est bien voulu.
          </p>
        </Card>

        <Card title="Si vous n'avez plus accès à l'application">
          <p>
            Écrivez à <a href="mailto:contact@buyticle.com" style={{ color: "var(--color-gold)" }}>contact@buyticle.com</a>{" "}
            depuis l&apos;adresse e-mail de votre compte, avec pour objet
            « Suppression de compte ». Nous vérifions qu&apos;il s&apos;agit bien de vous,
            puis nous procédons sous 30 jours au plus.
          </p>
        </Card>

        <Card title="Ce qui est effacé">
          <Bullets items={SUPPRIME} />
        </Card>

        <Card title="Ce qui subsiste, et pourquoi">
          <Bullets items={CONSERVE} />
        </Card>

        <footer className="pt-8 text-xs leading-relaxed" style={{ color: "var(--text-disabled)", borderTop: "1px solid var(--border-subtle)" }}>
          <p className="font-semibold" style={{ color: "var(--text-tertiary)" }}>BUYTICLE ETS</p>
          <p>N° RCCM : CM-DLA-01-2025-A10-01482</p>
          <p>Bonamoussadi, Douala — Cameroun</p>
          <p>Tél : (+237) 696 99 58 79 · contact@buyticle.com</p>
        </footer>
      </main>
    </div>
  );
}
