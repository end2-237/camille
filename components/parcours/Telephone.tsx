"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le téléphone d'aperçu : la conversation telle que le client la verra, avec
// les vrais composants WhatsApp (bulles, vocal, vidéo, aperçu de lien, boutons
// de réponse, liste, demande de position, réaction). On y joue le client :
// appuyer sur un bouton, écrire un mot-clé, envoyer sa position.
//
// Le chemin est décidé par aiguiller() et derouler() — exactement le code du
// moteur. Ce que montre l'aperçu, c'est ce que Camille enverra.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, CheckCheck, ChevronLeft, ExternalLink, FileText, List, MapPin, Mic, MoreVertical, Paperclip,
  Phone, Play, Reply, RotateCcw, Send, Video,
} from "lucide-react";
import {
  aiguiller, choixDe, derouler, MEDIA_AGENT, remplir,
  type Bloc, type EtatClient, type Message, type Parcours,
} from "@/lib/parcours-regles";

type Ligne =
  | { de: "client"; id: number; texte: string; reaction?: string }
  | { de: "agent"; id: number; bloc: Bloc }
  | { de: "note"; id: number; texte: string };

type Props = { p: Parcours; entreprise: string; onBloc?: (id: string) => void; onActifs?: (ids: Set<string>) => void };

const domaine = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const heure = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Le gras, l'italique, le barré et les liens de WhatsApp. */
function Format({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s]+)/g);
  return (
    <>
      {morceaux.map((m, i) =>
        /^\*[^*]+\*$/.test(m) ? <strong key={i}>{m.slice(1, -1)}</strong>
          : /^_[^_]+_$/.test(m) ? <em key={i}>{m.slice(1, -1)}</em>
          : /^~[^~]+~$/.test(m) ? <s key={i}>{m.slice(1, -1)}</s>
          : /^https?:\/\//.test(m) ? <span key={i} className="wa-lien">{m}</span>
          : <span key={i}>{m}</span>
      )}
    </>
  );
}

export default function Telephone({ p, entreprise, onBloc, onActifs }: Props) {
  const [prenom, setPrenom] = useState("Awa");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [etat, setEtat] = useState<EtatClient>({ attente: null, mode: null });
  const [saisie, setSaisie] = useState("");
  const [listeOuverte, setListeOuverte] = useState<Bloc | null>(null);
  const [humain, setHumain] = useState(false);
  const [dejaVenu, setDejaVenu] = useState(false);
  const fil = useRef<HTMLDivElement>(null);
  const compteur = useRef(0);
  const vars = useMemo(() => ({ prenom, nom: prenom, entreprise, telephone: "+237 6XX XX XX XX" }), [prenom, entreprise]);
  const t = (s?: string) => remplir(s || "", vars);

  useEffect(() => { fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: "smooth" }); }, [lignes]);

  function recommencer() {
    setLignes([]); setEtat({ attente: null, mode: null }); setHumain(false); setDejaVenu(false); setListeOuverte(null);
    onActifs?.(new Set());
  }
  // Un parcours modifié : l'aperçu repart de zéro, pour ne jamais montrer un état périmé.
  useEffect(() => { recommencer(); }, [JSON.stringify(p.blocs), JSON.stringify(p.declencheurs), p.par_defaut]); // eslint-disable-line react-hooks/exhaustive-deps

  function envoyer(affiche: string, message: Message) {
    const nouvelles: Ligne[] = [{ de: "client", id: ++compteur.current, texte: affiche }];
    if (humain) {
      const h = p.blocs.find((b) => b.type === "humain" && b.attente);
      nouvelles.push({ de: "note", id: ++compteur.current, texte: "👤 Un humain a la main : Camille se tait." });
      if (h && h.type === "humain" && !lignes.some((l) => l.de === "note" && l.texte.startsWith("⏳"))) {
        nouvelles.push({ de: "agent", id: ++compteur.current, bloc: { id: h.id, type: "texte", texte: h.attente || "" } });
        nouvelles.push({ de: "note", id: ++compteur.current, texte: "⏳ Message d'attente envoyé une fois." });
      }
      setLignes((l) => [...l, ...nouvelles]);
      return;
    }
    const route = aiguiller(p, etat, message, !dejaVenu);
    setDejaVenu(true);
    if ("mode" in route) {
      nouvelles.push({ de: "note", id: ++compteur.current, texte: route.mode === "agent" ? "🤖 L'IA de l'agent répond à ce message." : "🔕 Camille se tait : le message attend l'équipe." });
      setEtat({ attente: null, mode: route.mode });
      onActifs?.(new Set());
      setLignes((l) => [...l, ...nouvelles]);
      return;
    }
    const { blocs, fin } = derouler(p, route.depart);
    const actifs = new Set<string>(blocs.map((b) => b.id));
    let reaction: string | undefined;
    for (const b of blocs) {
      if (b.type === "pause") { nouvelles.push({ de: "note", id: ++compteur.current, texte: `⏱ ${b.secondes} s` }); continue; }
      if (b.type === "reaction") { reaction = b.emoji; continue; }
      if (b.type === "humain") {
        if (b.message) nouvelles.push({ de: "agent", id: ++compteur.current, bloc: { id: b.id, type: "texte", texte: b.message } });
        nouvelles.push({ de: "note", id: ++compteur.current, texte: "👤 Transféré au commerçant : Camille se tait pour ce client." });
        continue;
      }
      nouvelles.push({ de: "agent", id: ++compteur.current, bloc: b });
    }
    if (reaction) (nouvelles[0] as Extract<Ligne, { de: "client" }>).reaction = reaction;
    if (fin.type === "agent") nouvelles.push({ de: "note", id: ++compteur.current, texte: "🤖 L'IA de l'agent prend la suite." });
    if (fin.type === "silence") nouvelles.push({ de: "note", id: ++compteur.current, texte: "🔕 Fin de l'accueil : Camille se tait." });
    if (fin.type === "rien" && blocs.length === 0) nouvelles.push({ de: "note", id: ++compteur.current, texte: "Aucun bloc relié ici." });
    setHumain(fin.type === "humain");
    setEtat({ attente: fin.type === "attente" ? fin.bloc : null, mode: fin.type === "agent" ? "agent" : fin.type === "silence" ? "silence" : null });
    onActifs?.(actifs);
    setLignes((l) => [...l, ...nouvelles]);
  }

  const attendu = etat.attente ? p.blocs.find((b) => b.id === etat.attente) : null;
  const derniereAgent = [...lignes].reverse().find((l) => l.de === "agent") as Extract<Ligne, { de: "agent" }> | undefined;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center gap-2 whitespace-nowrap text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
        Prénom du client
        <input className="ui-champ h-8 w-[110px] text-[12.5px]" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        <button className="ml-auto flex items-center gap-1 font-medium" style={{ color: "var(--cl-ink)" }} onClick={recommencer}>
          <RotateCcw className="h-3.5 w-3.5" /> Recommencer
        </button>
      </div>

      <div className="wa-telephone">
        <div className="wa-encoche" />
        <div className="wa-entete">
          <ChevronLeft className="h-5 w-5" />
          <span className="wa-avatar">{(entreprise || "C").slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-semibold">{entreprise || "Votre entreprise"}</p>
            <p className="text-[11px] opacity-80">Compte professionnel</p>
          </div>
          <Video className="h-[18px] w-[18px]" /><Phone className="h-[17px] w-[17px]" /><MoreVertical className="h-[18px] w-[18px]" />
        </div>

        <div ref={fil} className="wa-fil">
          {lignes.length === 0 && (
            <div className="wa-vide">
              <p>Jouez le client : écrivez un premier message.</p>
              <button onClick={() => envoyer("Bonjour", { texte: "Bonjour" })}>Envoyer « Bonjour »</button>
            </div>
          )}
          {lignes.map((l) => {
            if (l.de === "note") return <p key={l.id} className="wa-note">{l.texte}</p>;
            if (l.de === "client") return (
              <div key={l.id} className="wa-ligne wa-droite">
                <div className="wa-bulle wa-moi">
                  <Format texte={l.texte} />
                  <span className="wa-heure">{heure()} <CheckCheck className="inline h-3.5 w-3.5" style={{ color: "#53BDEB" }} /></span>
                  {l.reaction && <span className="wa-reaction">{l.reaction}</span>}
                </div>
              </div>
            );
            const actif = derniereAgent?.id === l.id && etat.attente === l.bloc.id;
            return (
              <Bulle key={l.id} b={l.bloc} t={t} actif={actif} onBloc={onBloc}
                onChoix={(c) => envoyer(c.titre, { choixId: c.id })}
                onListe={() => setListeOuverte(l.bloc)}
                onPosition={() => envoyer("📍 Position envoyée", { position: true })} />
            );
          })}
        </div>

        {listeOuverte && (
          <div className="wa-feuille" onClick={() => setListeOuverte(null)}>
            <div className="wa-feuille-corps" onClick={(e) => e.stopPropagation()}>
              <p className="mb-2 text-center text-[13px] font-semibold">{listeOuverte.type === "liste" ? listeOuverte.bouton : "Choix"}</p>
              {choixDe(listeOuverte).map((c) => (
                <button key={c.id} className="wa-feuille-ligne" onClick={() => { setListeOuverte(null); envoyer(c.titre, { choixId: c.id }); }}>
                  <span className="min-w-0 flex-1 text-left"><span className="block truncate">{c.titre}</span>{c.description && <span className="block truncate text-[11.5px] opacity-60">{c.description}</span>}</span>
                  <span className="h-4 w-4 rounded-full border-2" style={{ borderColor: "#8696A0" }} />
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="wa-saisie" onSubmit={(e) => { e.preventDefault(); const s = saisie.trim(); if (!s) return; setSaisie(""); envoyer(s, { texte: s }); }}>
          <div className="wa-champ">
            <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={attendu ? "Répondre…" : "Message"} />
            <Paperclip className="h-[18px] w-[18px] opacity-60" /><Camera className="h-[18px] w-[18px] opacity-60" />
          </div>
          <button type="submit" className="wa-envoyer" aria-label="Envoyer">{saisie ? <Send className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}</button>
        </form>
      </div>
      <p className="text-center text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>
        Cliquez une bulle pour retrouver son bloc. Les pauses sont indiquées sans être attendues.
      </p>
      <StylesTelephone />
    </div>
  );
}

function Bulle({ b, t, actif, onChoix, onListe, onPosition, onBloc }: {
  b: Bloc; t: (s?: string) => string; actif: boolean;
  onChoix: (c: { id: string; titre: string }) => void; onListe: () => void; onPosition: () => void; onBloc?: (id: string) => void;
}) {
  const choix = b.type !== "liste" ? choixDe(b) : [];
  const media = (u: string) => (MEDIA_AGENT.test(u) ? "" : u);
  const corps = (() => {
    switch (b.type) {
      case "texte": return <Format texte={t(b.texte)} />;
      case "image": return <>{media(b.url) ? <img src={b.url} alt="" className="wa-media" /> : <div className="wa-media wa-media-vide">Image</div>}{b.legende && <p className="mt-1"><Format texte={t(b.legende)} /></p>}</>;
      case "video": return <>
        <div className="relative">
          {media(b.url) ? <video src={`${b.url}#t=0.5`} className="wa-media" preload="metadata" muted playsInline /> : <div className="wa-media wa-media-vide">Vidéo d&apos;accueil de l&apos;agent</div>}
          <span className="wa-play"><Play className="h-5 w-5" fill="currentColor" /></span>
        </div>
        {b.legende && <p className="mt-1"><Format texte={t(b.legende)} /></p>}
      </>;
      case "vocal": return (
        <div className="flex items-center gap-2 py-1">
          <span className="wa-vocal-avatar"><Mic className="h-4 w-4" /></span>
          <Play className="h-5 w-5" fill="#54656F" color="#54656F" />
          <span className="flex flex-1 items-center gap-[2px]">{Array.from({ length: 26 }, (_, i) => <span key={i} className="wa-onde" style={{ height: 4 + ((i * 37) % 17) }} />)}</span>
          <span className="text-[11px]" style={{ color: "#667781" }}>{MEDIA_AGENT.test(b.url) ? "accueil" : "0:24"}</span>
        </div>
      );
      case "document": return (
        <div className="flex items-center gap-2 rounded-[8px] p-2" style={{ background: "#F5F6F6" }}>
          <FileText className="h-8 w-8" color="#E0632B" /><span className="min-w-0 flex-1 truncate text-[13px]">{b.nom || b.url.split("/").pop()}</span>
        </div>
      );
      case "lien": return <>
        <div className="wa-apercu"><p className="text-[12.5px] font-semibold">{domaine(b.url)}</p><p className="truncate text-[11.5px] opacity-70">{b.url}</p></div>
        {b.texte && <p className="mt-1"><Format texte={t(b.texte)} /></p>}
        <span className="wa-lien block truncate">{b.url}</span>
      </>;
      case "bouton_lien": case "boutons": case "liste": case "position": return <Format texte={t(b.texte)} />;
      default: return null;
    }
  })();
  return (
    <div className="wa-ligne">
      <div className="wa-groupe" onClick={() => onBloc?.(b.id)}>
        <div className="wa-bulle wa-eux">
          {corps}
          <span className="wa-heure">{heure()}</span>
        </div>
        {b.type === "bouton_lien" && <div className="wa-bouton"><ExternalLink className="h-4 w-4" /> {b.libelle}</div>}
        {b.type === "liste" && <button className="wa-bouton" disabled={!actif} onClick={(e) => { e.stopPropagation(); onListe(); }}><List className="h-4 w-4" /> {b.bouton}</button>}
        {b.type === "position" && <button className="wa-bouton" disabled={!actif} onClick={(e) => { e.stopPropagation(); onPosition(); }}><MapPin className="h-4 w-4" /> Envoyer la position</button>}
        {choix.map((c) => (
          <button key={c.id} className="wa-bouton" disabled={!actif} onClick={(e) => { e.stopPropagation(); onChoix(c); }}>
            <Reply className="h-4 w-4" /> {c.titre || "…"}
          </button>
        ))}
      </div>
    </div>
  );
}

function StylesTelephone() {
  return (
    <style jsx global>{`
      .wa-telephone { position: relative; display: flex; flex-direction: column; width: 330px; height: 660px; border-radius: 46px; background: #111; padding: 12px; box-shadow: 0 30px 60px rgba(25,23,27,.25), inset 0 0 0 2px #2a2a2a; }
      .wa-encoche { position: absolute; left: 50%; top: 18px; z-index: 3; width: 96px; height: 24px; transform: translateX(-50%); border-radius: 999px; background: #000; }
      .wa-entete { display: flex; align-items: center; gap: 8px; padding: 40px 12px 10px; border-radius: 34px 34px 0 0; background: #008069; color: #fff; }
      .wa-avatar { display: inline-flex; width: 34px; height: 34px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 999px; background: #DFE5E7; color: #54656F; font-weight: 700; }
      .wa-fil { flex: 1; overflow-y: auto; padding: 10px 8px; background: #EFEAE2; font-size: 13.5px; line-height: 1.35; color: #111B21; }
      .wa-fil::-webkit-scrollbar { width: 0; }
      .wa-ligne { display: flex; margin: 3px 0; }
      .wa-droite { justify-content: flex-end; }
      .wa-groupe { max-width: 82%; cursor: pointer; }
      .wa-bulle { position: relative; padding: 6px 8px 18px; border-radius: 8px; box-shadow: 0 1px .5px rgba(11,20,26,.13); white-space: pre-wrap; word-break: break-word; }
      .wa-eux { background: #fff; border-top-left-radius: 0; }
      .wa-moi { max-width: 82%; background: #D9FDD3; border-top-right-radius: 0; }
      .wa-heure { position: absolute; right: 7px; bottom: 3px; font-size: 10.5px; color: #667781; }
      .wa-reaction { position: absolute; left: -6px; bottom: -14px; padding: 1px 4px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); font-size: 13px; }
      .wa-lien { color: #027EB5; }
      .wa-media { display: block; width: 100%; max-height: 220px; object-fit: cover; border-radius: 6px; background: #D1D7DB; }
      .wa-media-vide { display: flex; height: 120px; align-items: center; justify-content: center; color: #54656F; font-size: 12px; }
      .wa-play { position: absolute; left: 50%; top: 50%; display: flex; width: 42px; height: 42px; transform: translate(-50%, -50%); align-items: center; justify-content: center; border-radius: 999px; background: rgba(11,20,26,.55); color: #fff; }
      .wa-vocal-avatar { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border-radius: 999px; background: #25D366; color: #fff; }
      .wa-onde { display: inline-block; width: 2px; border-radius: 2px; background: #8696A0; }
      .wa-apercu { margin-bottom: 4px; border-radius: 6px; padding: 6px 8px; background: #F5F6F6; border-left: 3px solid #25D366; }
      .wa-bouton { display: flex; width: 100%; margin-top: 2px; align-items: center; justify-content: center; gap: 6px; border-radius: 8px; background: #fff; padding: 8px; color: #027EB5; font-size: 13.5px; font-weight: 500; box-shadow: 0 1px .5px rgba(11,20,26,.13); }
      .wa-bouton:disabled { color: #8FB9CC; cursor: default; }
      .wa-note { margin: 6px auto; width: fit-content; max-width: 90%; border-radius: 8px; background: #FFEECD; padding: 3px 8px; text-align: center; font-size: 11.5px; color: #54656F; }
      .wa-vide { margin-top: 40%; text-align: center; font-size: 12.5px; color: #54656F; }
      .wa-vide button { margin-top: 8px; border-radius: 999px; background: #008069; padding: 6px 14px; color: #fff; font-weight: 500; }
      .wa-saisie { display: flex; align-items: center; gap: 6px; padding: 6px 6px 10px; border-radius: 0 0 34px 34px; background: #EFEAE2; }
      .wa-champ { display: flex; flex: 1; align-items: center; gap: 8px; border-radius: 999px; background: #fff; padding: 8px 12px; color: #54656F; }
      .wa-champ input { min-width: 0; flex: 1; background: transparent; font-size: 13.5px; color: #111B21; outline: none; }
      .wa-envoyer { display: flex; width: 40px; height: 40px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 999px; background: #00A884; color: #fff; }
      .wa-feuille { position: absolute; inset: 12px; z-index: 4; display: flex; align-items: flex-end; border-radius: 34px; background: rgba(11,20,26,.35); }
      .wa-feuille-corps { width: 100%; max-height: 70%; overflow-y: auto; border-radius: 20px 20px 34px 34px; background: #fff; padding: 14px; }
      .wa-feuille-ligne { display: flex; width: 100%; align-items: center; gap: 10px; border-bottom: 1px solid #E9EDEF; padding: 10px 4px; font-size: 13.5px; color: #111B21; }
    `}</style>
  );
}

