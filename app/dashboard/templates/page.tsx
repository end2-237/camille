// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/templates/page.tsx
//
// Les modèles de message WhatsApp du commerçant.
//
// Pourquoi cette page existe : hors de la fenêtre de 24 h qui suit le dernier
// message du client, seul un modèle approuvé par Meta peut partir. C'est le cas
// de l'accusé de commande envoyé le lendemain, du suivi de livraison, et de la
// réponse à une réclamation. Sans cette page, le commerçant devrait aller les
// créer dans les outils de Meta — qu'il ne connaît pas et dont tout l'intérêt
// de Camille est de le dispenser.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, FileText, Megaphone, Plus, RefreshCw, Send, Trash2, Wrench, X } from "lucide-react";
import { authHeaders } from "@/lib/auth-client";
import { Bandeau, Bouton, BoutonRond, Pastille, Squelettes, StylesUI, Vide, apparait, type Ton } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

type Template = {
  id?: string;
  name: string;
  status?: string;
  category?: string;
  language?: string;
};

/** Ce que le commerçant comprend, par opposition au statut technique de Meta. */
const ETAT: Record<string, { texte: string; ton: Ton }> = {
  APPROVED: { texte: "Approuvé", ton: "vert" },
  PENDING: { texte: "En attente", ton: "ambre" },
  IN_APPEAL: { texte: "En appel", ton: "ambre" },
  REJECTED: { texte: "Refusé", ton: "rouge" },
  PAUSED: { texte: "Suspendu", ton: "rouge" },
  DISABLED: { texte: "Désactivé", ton: "gris" },
};

const CATEGORIES = [
  { v: "UTILITY", l: "Utilitaire", Icone: Wrench, aide: "Information liée à une commande du client. C'est ce qu'il faut dans presque tous les cas." },
  { v: "MARKETING", l: "Marketing", Icone: Megaphone, aide: "Promotion, nouveauté. Plus cher, et refusable si le client n'a rien demandé." },
];

// Les trois modèles dont tout commerce a besoin. Proposés tels quels pour que
// le commerçant n'ait pas la page blanche devant un formulaire Meta.
const MODELES = [
  {
    l: "Commande confirmée",
    name: "commande_confirmee",
    body: "Bonjour {{1}}, ta commande {{2}} est bien enregistrée ✅ Total : {{3}}. On te prévient dès qu'elle part.",
    examples: ["David", "BC-AA12", "9 000 FCFA"],
  },
  {
    l: "Partie en livraison",
    name: "livraison",
    body: "Bonjour {{1}}, ta commande {{2}} vient de partir en livraison 🛵 Tu la reçois très bientôt !",
    examples: ["David", "BC-AA12"],
  },
  {
    l: "Réclamation prise en charge",
    name: "reclamation_prise_en_charge",
    body: "Bonjour {{1}}, on a bien reçu ton message et quelqu'un s'en occupe 🙏 On te répond ici même très vite.",
    examples: ["David"],
  },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [aSupprimer, setASupprimer] = useState<string>("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/whatsapp/templates", { headers: { ...authHeaders() } });
      const d = await r.json();
      if (d.error) setErr(d.error);
      setTemplates(Array.isArray(d.templates) ? d.templates : []);
    } catch (e) {
      setErr((e as Error).message);
      setTemplates([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Le nombre d'exemples suit les variables écrites dans le message : Meta
  // refuse un modèle dont il ne peut pas juger le rendu réel.
  const variables = (body.match(/\{\{\s*\d+\s*\}\}/g) || []).length;

  function prendreModele(m: (typeof MODELES)[number]) {
    setName(m.name);
    setBody(m.body);
    setExamples(m.examples);
    setCategory("UTILITY");
    setFooter("");
    setMsg("");
  }

  async function soumettre() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, category, body, footer, examples, language: "fr" }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setMsg(d.error || "Soumission refusée"); return; }
      setMsg(`Soumis à Meta — statut ${d.status}. L'examen prend jusqu'à 24 h.`);
      setName(""); setBody(""); setFooter(""); setExamples([]);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function supprimer(nom: string) {
    setBusy(true); setNote("");
    try {
      const r = await fetch(`/api/whatsapp/templates?name=${encodeURIComponent(nom)}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const d = await r.json();
      if (!r.ok || d.error) { setNote(d.error || "Suppression refusée"); return; }
      setNote(d.avertissement || `« ${nom} » supprimé.`);
      setASupprimer("");
      await load();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // L'aperçu remplace {{1}}, {{2}}… par les exemples : on voit ce que le
  // client recevra, pas une formule.
  const apercu = body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => examples[Number(n) - 1] || `{{${n}}}`);
  const approuves = (templates || []).filter((t) => t.status === "APPROVED").length;

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <Bandeau ton="violet" titre="Pourquoi des modèles ?">
            Passé 24 h sans nouvelle du client, WhatsApp n&apos;accepte que des messages approuvés à l&apos;avance :
            l&apos;accusé envoyé le lendemain, le suivi de livraison, la réponse à une réclamation.
          </Bandeau>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>
              Vos modèles {templates && <span className="text-[13px] font-normal" style={{ color: "var(--cl-ink-faint)" }}>· {approuves} approuvé{approuves > 1 ? "s" : ""} sur {templates.length}</span>}
            </p>
            <div className="flex items-center gap-2">
              <BoutonRond icone={RefreshCw} label="Actualiser" onClick={load} />
              {!form && <Bouton variante="encre" icone={Plus} onClick={() => setForm(true)}>Créer un modèle</Bouton>}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {err && <Bandeau ton="rouge">{err}</Bandeau>}
            {note && <Bandeau ton={note.includes("supprimé") ? "vert" : "rouge"}>{note}</Bandeau>}
          </div>

          <div className="mt-4">
            {templates === null ? (
              <Squelettes n={3} hauteur={76} />
            ) : templates.length === 0 ? (
              <Vide doodle="reading" titre="Aucun modèle pour le moment." texte="Partez d'un des trois modèles courants : la création ne prend qu'une minute."
                action={!form ? <Bouton variante="encre" icone={Plus} onClick={() => setForm(true)}>Créer un modèle</Bouton> : undefined} />
            ) : (
              <motion.ul layout className="grid gap-3 xl:grid-cols-2">
                <AnimatePresence initial={false}>
                  {templates.map((t, i) => {
                    const e = ETAT[String(t.status)] || { texte: t.status || "—", ton: "gris" as Ton };
                    const confirme = aSupprimer === t.name;
                    return (
                      <motion.li key={t.id || t.name} layout {...apparait(i)} exit={{ opacity: 0, scale: 0.97 }}
                        className="ui-carte rounded-[24px] p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                            <FileText className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{t.name}</p>
                            <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                              {t.category === "UTILITY" ? "Utilitaire" : t.category === "MARKETING" ? "Marketing" : t.category}
                              {t.language ? ` · ${t.language}` : ""}
                            </p>
                          </div>
                          <Pastille ton={e.ton} point>{e.texte}</Pastille>
                          {!confirme && (
                            <BoutonRond icone={Trash2} label="Supprimer ce modèle" onClick={() => { setASupprimer(t.name); setNote(""); }} />
                          )}
                        </div>
                        {/* La seule conséquence irréversible de la suppression, dite avant. */}
                        <AnimatePresence>
                          {confirme && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={RESSORT} className="overflow-hidden">
                              <div className="mt-3 rounded-[18px] p-3.5 text-[13px] leading-relaxed" style={{ background: "#FDF1DC", color: "#6B4500" }}>
                                Les messages déjà envoyés ne changent pas, mais <strong>Meta garde ce nom bloqué longtemps</strong>.
                                Pour réécrire ce message plus tard, il faudra un autre nom.
                                <div className="mt-3 flex gap-2">
                                  <Bouton variante="danger" icone={Trash2} occupe={busy} disabled={busy} onClick={() => supprimer(t.name)}>Supprimer</Bouton>
                                  <Bouton variante="clair" onClick={() => setASupprimer("")}>Garder</Bouton>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </motion.ul>
            )}
          </div>

          {/* ── Création ──────────────────────────────────────────────────── */}
          <AnimatePresence>
            {form && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={RESSORT}
                className="ui-carte mt-6 rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>Nouveau modèle</p>
                    <p className="text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>Partez d&apos;un modèle courant, ou écrivez le vôtre.</p>
                  </div>
                  <BoutonRond icone={X} label="Fermer" onClick={() => { setForm(false); setMsg(""); }} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {MODELES.map((m) => (
                    <button key={m.name} onClick={() => prendreModele(m)}
                      className="rounded-full px-4 py-2 text-[13px] transition-colors"
                      style={name === m.name ? { background: "var(--cl-ink)", color: "#fff" } : { background: "#F4F2F7", color: "var(--cl-ink)" }}>
                      {m.l}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-5">
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Nom</span>
                    <input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="livraison" className="ui-champ" />
                    <span className="px-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Minuscules, chiffres et tirets bas. Le client ne le voit pas.</span>
                  </label>

                  {/* La catégorie : deux grands boutons radio plutôt qu'une liste. */}
                  <div className="grid gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Catégorie</span>
                    <div role="radiogroup" aria-label="Catégorie" className="grid gap-2 sm:grid-cols-2">
                      {CATEGORIES.map((c) => {
                        const actif = category === c.v;
                        return (
                          <button key={c.v} role="radio" aria-checked={actif} onClick={() => setCategory(c.v)}
                            className="flex items-start gap-3 rounded-[20px] p-3.5 text-left transition-shadow"
                            style={{ background: actif ? "var(--cl-accent-soft)" : "#F7F6FA", boxShadow: actif ? "inset 0 0 0 2px var(--cl-accent)" : "none" }}>
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                              style={{ boxShadow: `inset 0 0 0 2px ${actif ? "var(--cl-accent)" : "#CFC9DA"}`, background: "#fff" }}>
                              {actif && <motion.span layoutId="tpl-radio" transition={RESSORT} className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cl-accent)" }} />}
                            </span>
                            <span>
                              <span className="flex items-center gap-1.5 text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}><c.Icone className="h-4 w-4" /> {c.l}</span>
                              <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: "var(--cl-ink-faint)" }}>{c.aide}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Message</span>
                    <textarea id="tpl-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4}
                      placeholder="Bonjour {{1}}, ta commande {{2}} vient de partir en livraison 🛵" className="ui-champ" />
                    <span className="px-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                      Écrivez <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… là où viendront le prénom, la référence ou le montant.
                    </span>
                  </label>

                  {variables > 0 && (
                    <div className="grid gap-2">
                      <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Exemples · {variables} variable{variables > 1 ? "s" : ""}</span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Array.from({ length: variables }, (_, i) => (
                          <input key={i} id={`tpl-ex-${i}`} value={examples[i] || ""} className="ui-champ"
                            onChange={(e) => { const v = [...examples]; v[i] = e.target.value; setExamples(v); }}
                            placeholder={`Exemple pour {{${i + 1}}}`} />
                        ))}
                      </div>
                      <span className="px-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Meta juge le rendu réel avec ces exemples. Ils ne partent jamais à un client.</span>
                    </div>
                  )}

                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Pied de page <span className="font-normal" style={{ color: "var(--cl-ink-faint)" }}>· facultatif</span></span>
                    <input id="tpl-footer" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="BUYTICLE · Douala" className="ui-champ" />
                  </label>
                </div>

                {msg && <div className="mt-4"><Bandeau ton={msg.startsWith("Soumis") ? "vert" : "rouge"}>{msg}</Bandeau></div>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Bouton variante="encre" icone={Send} occupe={busy} onClick={soumettre} disabled={busy || !name.trim() || !body.trim()}>
                    {busy ? "Envoi…" : "Soumettre à Meta"}
                  </Bouton>
                  <Bouton variante="clair" onClick={() => { setForm(false); setMsg(""); }}>Fermer</Bouton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── À côté : l'aperçu, comme le client le verra ─────────────────── */}
        <aside className="lg:sticky lg:top-[96px] lg:self-start">
          <motion.div {...apparait(1)} className="overflow-hidden rounded-[30px]" style={{ background: "#EFE7DD" }}>
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: "#1F5C4B", color: "#fff" }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-[14px] font-semibold">B</span>
              <div>
                <p className="text-[14px] font-medium">Votre boutique</p>
                <p className="text-[11.5px] text-white/70">Aperçu du modèle</p>
              </div>
            </div>
            <div className="min-h-[260px] px-4 py-6">
              <AnimatePresence mode="wait">
                <motion.div key={apercu ? "plein" : "vide"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={RESSORT}
                  className="max-w-[88%] rounded-[18px] rounded-tl-[6px] bg-white px-4 py-3 shadow-sm">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "#111" }}>
                    {apercu || "Votre message apparaîtra ici, avec les exemples à la place de {{1}}, {{2}}…"}
                  </p>
                  {footer && <p className="mt-1.5 text-[12px]" style={{ color: "#8A8A8A" }}>{footer}</p>}
                  <p className="mt-1 flex items-center justify-end gap-1 text-[11px]" style={{ color: "#8A8A8A" }}>
                    12:04 <CheckCheck className="h-3.5 w-3.5" style={{ color: "#53BDEB" }} />
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
          <p className="mt-3 px-2 text-[12.5px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
            L&apos;examen par Meta prend en général quelques minutes, parfois jusqu&apos;à 24 h. Un modèle « Utilitaire » est presque toujours accepté.
          </p>
        </aside>
      </div>
    </div>
  );
}
