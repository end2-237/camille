"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Créer un agent — dans la lignée de la page de connexion : deux colonnes,
// clair, aux couleurs de Camille.
//
// À droite, trois étapes courtes (le commerce, l'agent, la vérification). À
// gauche, l'aperçu WhatsApp suit chaque frappe : le commerçant voit son agent
// saluer un client avec son nom, celui de sa boutique et le ton choisi, avant
// même de l'avoir créé.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, ArrowRight, Check, CheckCheck, Loader2, Rocket, ShoppingBag, UtensilsCrossed, Sparkles,
  HeartPulse, Hotel, GraduationCap, Home, Landmark, Laptop, Briefcase, MoreHorizontal, Gift,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/auth-client";
import { generateSystemPrompt } from "@/lib/generateSystemPrompt";
import type { AgentFormData, BusinessSector, BrandTone } from "@/types/agent";

const schema = z.object({
  business_name: z.string().trim().min(2, "Le nom de votre commerce"),
  sector:        z.string().min(1, "Choisissez votre activité"),
  description:   z.string().trim().min(10, "Quelques mots sur ce que vous vendez (10 caractères au moins)"),
  agent_name:    z.string().trim().min(2, "Donnez-lui un prénom"),
  brand_voice:   z.enum(["professional", "friendly", "casual", "luxury"]),
});
type FormData = z.infer<typeof schema>;

const SECTEURS: { value: string; label: string; icone: React.ElementType }[] = [
  { value: "ecommerce",       label: "Boutique",        icone: ShoppingBag },
  { value: "food_beverage",   label: "Restauration",    icone: UtensilsCrossed },
  { value: "beauty_wellness", label: "Beauté",          icone: Sparkles },
  { value: "healthcare",      label: "Santé",           icone: HeartPulse },
  { value: "hospitality",     label: "Hôtellerie",      icone: Hotel },
  { value: "education",       label: "Formation",       icone: GraduationCap },
  { value: "real_estate",     label: "Immobilier",      icone: Home },
  { value: "finance",         label: "Finance",         icone: Landmark },
  { value: "tech_saas",       label: "Tech",            icone: Laptop },
  { value: "consulting",      label: "Conseil",         icone: Briefcase },
  { value: "other",           label: "Autre",           icone: MoreHorizontal },
];

const TONS: { value: FormData["brand_voice"]; label: string; desc: string }[] = [
  { value: "friendly",     label: "Amical",        desc: "Chaleureux, proche" },
  { value: "professional", label: "Professionnel", desc: "Clair, rassurant" },
  { value: "casual",       label: "Décontracté",   desc: "Direct, spontané" },
  { value: "luxury",       label: "Haut de gamme", desc: "Élégant, attentionné" },
];

const ETAPES = ["Votre commerce", "Votre agent", "C'est parti"];

/** Ce que dit l'agent au premier message, selon le ton : l'aperçu de gauche. */
function salut(ton: FormData["brand_voice"], agent: string, commerce: string) {
  const a = agent.trim() || "Aria";
  const c = commerce.trim() || "votre boutique";
  switch (ton) {
    case "professional": return `Bonjour et bienvenue chez ${c}. Je suis ${a}, comment puis-je vous aider ?`;
    case "casual":       return `Hello ! ${a} ici 😄 Dis-moi ce que tu cherches chez ${c}, je m'occupe du reste.`;
    case "luxury":       return `Bonsoir, je suis ${a}, votre conseillère chez ${c}. Que puis-je faire pour vous aujourd'hui ?`;
    default:             return `Bonjour 👋 Moi c'est ${a}, de ${c} ! Je vous montre ce qu'on a ?`;
  }
}

export default function ConfigurePage() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [etape, setEtape] = useState(0);
  const [sens, setSens] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [limite, setLimite] = useState<string | null>(null);

  useEffect(() => { if (!isLoggedIn) router.replace("/login?suite=/configure"); }, [isLoggedIn, router]);
  // Créer un agent demande une adresse confirmée : on passe par le code
  // AVANT le formulaire, pour ne rien faire retaper.
  useEffect(() => {
    if (user?.email_verified === false) router.replace("/verifier-email?suite=/configure");
  }, [user, router]);

  const { register, handleSubmit, trigger, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { brand_voice: "friendly", sector: "" },
    mode: "onTouched",
  });
  const v = watch();

  const CHAMPS: (keyof FormData)[][] = [["business_name", "sector", "description"], ["agent_name", "brand_voice"], []];

  async function suivant() {
    if (!(await trigger(CHAMPS[etape]))) return;
    setSens(1);
    setEtape((e) => Math.min(e + 1, 2));
  }
  function precedent() {
    setSens(-1);
    setEtape((e) => Math.max(e - 1, 0));
  }

  const creer = handleSubmit(async (data) => {
    setEnvoi(true);
    setLimite(null);
    try {
      const formData: AgentFormData = {
        business_name:    data.business_name.trim(),
        owner_name:       user?.full_name || "Propriétaire",
        owner_email:      user?.email || "",
        sector:           data.sector as BusinessSector,
        description:      data.description.trim(),
        agent_name:       data.agent_name.trim(),
        brand_voice:      data.brand_voice as BrandTone,
        primary_language: "fr",
        capabilities: {
          support_whatsapp: true, content_generation: false, image_creation: false, community_management: false,
          strategy_advisor: false, lead_capture: false, proactive_messaging: false, calendar_booking: false,
        },
        target_model:     "claude-3-5-sonnet-20241022",
        faq:              [],
        forbidden_topics: [],
      };
      const systemPrompt = generateSystemPrompt(formData, formData.target_model);
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ formData, systemPrompt }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.code === "email_non_verifie") { router.push("/verifier-email?suite=/configure"); return; }
        if (d.code === "limite_agents_gratuits") { setLimite(d.error); return; }
        throw new Error(d.error ?? "Création impossible");
      }
      toast.success(`${d.agent.identity.name} est prêt !`, { description: "Connectez maintenant son WhatsApp." });
      router.push(`/dashboard/${d.agent.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Création impossible");
    } finally {
      setEnvoi(false);
    }
  });

  const erreur = (m?: string) => (m ? <p className="mt-1.5 text-[12px]" style={{ color: "#C2504B" }}>{m}</p> : null);
  const secteur = SECTEURS.find((s) => s.value === v.sector);
  const ton = TONS.find((t) => t.value === v.brand_voice);

  return (
    <div className="cfg flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── Gauche : l'agent, en direct ───────────────────────────────── */}
        <aside className="cfg-gauche cfg-pv hidden min-h-0 flex-col px-12 lg:flex lg:w-1/2 xl:px-16">
          <Marque />
          <h1 className="cfg-titre font-bold leading-[1.08] tracking-[-0.03em]" style={{ color: "var(--cl-ink)" }}>
            Votre vendeur,<br />en deux minutes.
          </h1>
          <p className="cfg-accroche max-w-[440px] leading-[1.55]" style={{ color: "var(--cl-ink-soft)" }}>
            Voici comment il accueillera vos clients sur WhatsApp. Tout se règle ensuite depuis le tableau de bord.
          </p>
          <div className="flex min-h-0 flex-1 items-center justify-center py-6">
            <ApercuWhatsapp agent={v.agent_name || ""} commerce={v.business_name || ""}
              message={salut(v.brand_voice, v.agent_name || "", v.business_name || "")} />
          </div>
        </aside>

        {/* ── Droite : les étapes ───────────────────────────────────────── */}
        <main className="cfg-pv flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 sm:px-10">
          <div className="mb-5 self-stretch lg:hidden"><Marque /></div>

          <div className="cfg-carte w-full max-w-[540px] rounded-2xl bg-white px-6 sm:px-9">
            {/* Les étapes */}
            <div className="flex items-center gap-2">
              {ETAPES.map((e, i) => (
                <div key={e} className="flex flex-1 items-center gap-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors"
                    style={{
                      background: i < etape ? "var(--cl-accent-deep)" : i === etape ? "var(--cl-accent-soft)" : "#F4F2F7",
                      color: i < etape ? "#fff" : i === etape ? "var(--cl-accent-deep)" : "var(--cl-ink-faint)",
                    }}>
                    {i < etape ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="hidden truncate text-[12.5px] font-medium sm:block" style={{ color: i === etape ? "var(--cl-ink)" : "var(--cl-ink-faint)" }}>{e}</span>
                  {i < ETAPES.length - 1 && <span className="h-px flex-1" style={{ background: i < etape ? "var(--cl-accent)" : "var(--cl-line)" }} />}
                </div>
              ))}
            </div>

            <form noValidate onSubmit={(e) => { if (etape < 2) { e.preventDefault(); suivant(); } else creer(e); }}>
              <div className="cfg-corps relative">
                <AnimatePresence mode="wait" custom={sens} initial={false}>
                  <motion.div key={etape} custom={sens}
                    initial={{ opacity: 0, x: sens * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: sens * -24 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>

                    {etape === 0 && (
                      <>
                        <h2 className="cfg-h2 font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>Votre commerce</h2>
                        <p className="mt-1 text-[15px]" style={{ color: "var(--cl-ink-soft)" }}>Ce que votre agent doit savoir pour bien vendre.</p>
                        <div className="cfg-form">
                          <Champ label="Nom du commerce">
                            <input {...register("business_name")} autoFocus placeholder="Ex. Boutique Marie" className="cfg-input" />
                            {erreur(errors.business_name?.message)}
                          </Champ>
                          <Champ label="Activité">
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                              {SECTEURS.map(({ value, label, icone: Icone }) => {
                                const actif = v.sector === value;
                                return (
                                  <button key={value} type="button" onClick={() => setValue("sector", value, { shouldValidate: true })}
                                    className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[12.5px] transition"
                                    style={{
                                      background: actif ? "var(--cl-accent-soft)" : "#fff",
                                      border: `1px solid ${actif ? "var(--cl-accent)" : "#E4E0EA"}`,
                                      color: actif ? "var(--cl-accent-deep)" : "var(--cl-ink-soft)",
                                      fontWeight: actif ? 600 : 500,
                                    }}>
                                    <Icone className="h-[18px] w-[18px]" />
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                            {erreur(errors.sector?.message)}
                          </Champ>
                          <Champ label="Ce que vous vendez">
                            <textarea {...register("description")} rows={3}
                              placeholder="Ex. Vêtements et chaussures pour femmes, livraison à Douala et Yaoundé."
                              className="cfg-input cfg-zone" />
                            {erreur(errors.description?.message)}
                          </Champ>
                        </div>
                      </>
                    )}

                    {etape === 1 && (
                      <>
                        <h2 className="cfg-h2 font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>Votre agent</h2>
                        <p className="mt-1 text-[15px]" style={{ color: "var(--cl-ink-soft)" }}>Son prénom et sa façon de parler à vos clients.</p>
                        <div className="cfg-form">
                          <Champ label="Prénom de l'agent">
                            <input {...register("agent_name")} autoFocus placeholder="Ex. Aria, Max, Sophie…" className="cfg-input" />
                            {erreur(errors.agent_name?.message)}
                          </Champ>
                          <Champ label="Ton">
                            <div className="grid grid-cols-2 gap-2">
                              {TONS.map((t) => {
                                const actif = v.brand_voice === t.value;
                                return (
                                  <button key={t.value} type="button" onClick={() => setValue("brand_voice", t.value, { shouldValidate: true })}
                                    className="rounded-xl px-4 py-3 text-left transition"
                                    style={{ background: actif ? "var(--cl-accent-soft)" : "#fff", border: `1px solid ${actif ? "var(--cl-accent)" : "#E4E0EA"}` }}>
                                    <span className="block text-[14px] font-semibold" style={{ color: actif ? "var(--cl-accent-deep)" : "var(--cl-ink)" }}>{t.label}</span>
                                    <span className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>{t.desc}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </Champ>
                          {/* Téléphone : l'aperçu n'a pas de colonne, il vient ici. */}
                          <div className="lg:hidden">
                            <p className="mb-1.5 text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>Aperçu</p>
                            <div className="rounded-xl px-4 py-3 text-[14px] leading-snug" style={{ background: "#E7FCE3", color: "#111B21" }}>
                              {salut(v.brand_voice, v.agent_name || "", v.business_name || "")}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {etape === 2 && (
                      <>
                        <h2 className="cfg-h2 font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>C&apos;est parti</h2>
                        <p className="mt-1 text-[15px]" style={{ color: "var(--cl-ink-soft)" }}>Vérifiez, puis créez votre agent.</p>
                        <div className="cfg-form">
                          <dl className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--cl-line-soft)" }}>
                            {[
                              ["Commerce", v.business_name],
                              ["Activité", secteur?.label],
                              ["Agent", v.agent_name],
                              ["Ton", ton?.label],
                            ].map(([k, val], i) => (
                              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 text-[14px]"
                                style={{ background: i % 2 ? "#fff" : "#FAF9FC" }}>
                                <dt style={{ color: "var(--cl-ink-faint)" }}>{k}</dt>
                                <dd className="truncate font-medium" style={{ color: "var(--cl-ink)" }}>{val || "—"}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="flex items-start gap-3 rounded-xl p-4 text-[13.5px] leading-[1.5]" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-ink-soft)" }}>
                            <Gift className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
                            <span>
                              Votre premier agent démarre avec <b style={{ color: "var(--cl-ink)" }}>14 jours d&apos;essai</b>. Ensuite : connectez
                              son WhatsApp et ajoutez votre catalogue depuis le tableau de bord.
                            </span>
                          </div>
                          {limite && (
                            <div className="rounded-xl p-4 text-[13.5px] leading-[1.5]" style={{ background: "#FDF1EE", color: "#9A3A26" }}>
                              {limite}{" "}
                              <Link href="/dashboard/billing" className="font-semibold underline">Voir les forfaits</Link>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="cfg-actions flex items-center gap-3">
                {etape > 0 && (
                  <button type="button" onClick={precedent} className="cfg-secondaire flex items-center justify-center gap-2 px-5">
                    <ArrowLeft className="h-4 w-4" /> Retour
                  </button>
                )}
                {etape < 2 ? (
                  // Deux boutons distincts (key) : sinon React réutilise le même
                  // élément, qui devient « submit » pendant le clic sur
                  // « Continuer » — et l'agent se créait tout seul à l'étape 3.
                  <button key="suivant" type="button" onClick={(e) => { e.preventDefault(); suivant(); }}
                    className="cfg-btn flex flex-1 items-center justify-center gap-2 rounded-lg font-semibold text-white"
                    style={{ background: "var(--cl-accent-deep)" }}>
                    Continuer <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button key="creer" type="submit" disabled={envoi}
                    className="cfg-btn flex flex-1 items-center justify-center gap-2 rounded-lg font-semibold text-white disabled:opacity-70"
                    style={{ background: "var(--cl-accent-deep)" }}>
                    {envoi ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {envoi ? "Création…" : "Créer mon agent"}
                  </button>
                )}
              </div>
            </form>
          </div>

          <p className="cfg-lien text-center text-[14px]" style={{ color: "var(--cl-ink-soft)" }}>
            <Link href="/dashboard" className="font-medium hover:underline" style={{ color: "var(--cl-accent-deep)" }}>
              Retour au tableau de bord
            </Link>
          </p>
        </main>
      </div>

      <style jsx>{`
        .cfg { background: #fff; font-family: "Inter Variable", "Inter", system-ui, sans-serif; }
        .cfg-pv { padding-top: clamp(14px, 3.2vh, 44px); padding-bottom: clamp(14px, 3.2vh, 44px); }
        .cfg-gauche { background: linear-gradient(180deg, #FAF8FF 0%, #F5F1FF 100%); }
        .cfg-titre { margin-top: clamp(16px, 4.5vh, 56px); font-size: clamp(30px, 4.6vh, 44px); }
        .cfg-accroche { margin-top: clamp(8px, 1.8vh, 20px); font-size: clamp(14.5px, 1.9vh, 17px); }
        .cfg-carte { padding-top: clamp(18px, 3.4vh, 32px); padding-bottom: clamp(18px, 3.4vh, 32px);
          box-shadow: 0 1px 2px rgba(25,23,27,0.04), 0 18px 50px rgba(100,66,232,0.08); border: 1px solid var(--cl-line-soft); }
        .cfg-corps { margin-top: clamp(16px, 3vh, 28px); }
        .cfg-h2 { font-size: clamp(22px, 3vh, 28px); }
        .cfg-lien { margin-top: clamp(10px, 2.2vh, 22px); }
        .cfg-actions { margin-top: clamp(16px, 3vh, 28px); }
        :global(.cfg-form) { margin-top: clamp(14px, 2.6vh, 24px); display: flex; flex-direction: column; gap: clamp(12px, 2vh, 20px); }
        :global(.cfg-input) {
          width: 100%; height: clamp(42px, 5.4vh, 50px); border-radius: 8px; padding: 0 16px; font-size: 16px;
          color: var(--cl-ink); background: #fff; border: 1px solid #D9D5DF; outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        :global(.cfg-zone) { height: auto; padding: 12px 16px; resize: none; line-height: 1.45; }
        :global(.cfg-input::placeholder) { color: #8E88A0; }
        :global(.cfg-input:focus) { border-color: var(--cl-accent); box-shadow: 0 0 0 3px rgba(124,90,248,0.14); }
        :global(.cfg-btn) { height: clamp(44px, 6vh, 54px); font-size: 16px; box-shadow: 0 8px 22px rgba(100,66,232,0.28); transition: filter .15s, transform .1s; }
        :global(.cfg-btn:hover) { filter: brightness(1.06); }
        :global(.cfg-btn:active) { transform: scale(0.98); }
        :global(.cfg-secondaire) {
          height: clamp(44px, 6vh, 54px); border-radius: 8px; font-size: 15px; font-weight: 500;
          color: var(--cl-ink); background: #fff; border: 1px solid #D9D5DF; transition: background .15s, border-color .15s;
        }
        :global(.cfg-secondaire:hover) { background: var(--cl-accent-soft); border-color: var(--cl-lavender); }
      `}</style>
    </div>
  );
}

function Marque() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3.5">
      <Image src="/icons/camille-192.png" alt="" width={44} height={44} className="rounded-xl" />
      <div className="leading-tight">
        <div className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)", fontFamily: "var(--font-good-timing)" }}>Camille</div>
        <div className="text-[12.5px] font-medium tracking-[0.14em]" style={{ color: "var(--cl-ink-soft)" }}>BY BUYTICLE</div>
      </div>
    </Link>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</label>
      {children}
    </div>
  );
}

// ── L'aperçu WhatsApp ───────────────────────────────────────────────────────

function ApercuWhatsapp({ agent, commerce, message }: { agent: string; commerce: string; message: string }) {
  const nom = agent.trim() || "Votre agent";
  const heure = useMemo(() => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), []);
  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[36px] p-2.5"
      style={{ background: "#1C1A21", boxShadow: "0 30px 70px rgba(70,40,190,0.22)" }}>
      <div className="overflow-hidden rounded-[28px]" style={{ background: "#EFEAE2" }}>
        <div className="flex items-center gap-3 px-4 pb-3 pt-4" style={{ background: "#075E54", color: "#fff" }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-semibold" style={{ background: "rgba(255,255,255,0.18)" }}>
            {nom.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-semibold">{commerce.trim() || "Votre commerce"}</p>
            <p className="text-[12px] opacity-80">en ligne</p>
          </div>
        </div>
        <div className="space-y-2.5 px-3 py-4" style={{ minHeight: 260 }}>
          <Bulle cote="client" heure={heure}>Bonsoir, vous avez quoi en ce moment ?</Bulle>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={message} initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}>
              <Bulle cote="agent" heure={heure} nom={nom}>{message}</Bulle>
            </motion.div>
          </AnimatePresence>
          <Bulle cote="client" heure={heure}>Je peux voir le catalogue ?</Bulle>
          <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: "#9AA3A8" }}
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bulle({ cote, heure, nom, children }: { cote: "client" | "agent"; heure: string; nom?: string; children: React.ReactNode }) {
  const client = cote === "client";
  return (
    <div className={"flex " + (client ? "justify-end" : "justify-start")}>
      <div className={"max-w-[82%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug shadow-sm " + (client ? "rounded-tr-sm" : "rounded-tl-sm")}
        style={{ background: client ? "#D9FDD3" : "#fff", color: "#111B21" }}>
        {nom && <p className="mb-0.5 text-[12px] font-semibold" style={{ color: "#6442E8" }}>{nom}</p>}
        {children}
        <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10.5px]" style={{ color: "#667781" }}>
          {heure}{client && <CheckCheck className="h-3.5 w-3.5" style={{ color: "#53BDEB" }} />}
        </span>
      </div>
    </div>
  );
}
