"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le canevas des parcours, façon n8n : des nœuds qu'on déplace, des flèches
// qu'on tire d'une sortie à une entrée, un clic pour régler un bloc, la
// touche Suppr pour l'enlever. Tout geste modifie le parcours lui-même.
// ─────────────────────────────────────────────────────────────────────────────

import "@xyflow/react/dist/style.css";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  applyNodeChanges, Background, BackgroundVariant, Controls, Handle, MiniMap, Position as Cote, ReactFlow, ReactFlowProvider, useReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps,
} from "@xyflow/react";
import {
  Bot, BellOff, CircleStop, CornerDownRight, ExternalLink, FileText, Film, Image as ImageIcon, LayoutGrid, Link as LinkIcon,
  List, MapPin, MessageSquareText, Mic, MousePointerClick, Plus, SmilePlus, Timer, UserRound, Zap,
} from "lucide-react";
import { liensDe, TYPES, type Bloc, type Declencheur, type Famille, type Parcours, type TypeBloc } from "@/lib/parcours-regles";
import {
  ajouterBloc, ajouterDeclencheur, delier, disposer, estDeclencheur, indexDecl, libelleDeclencheur, lier, PREFIXE_DECL,
  resume, sortiesDe, supprimerBloc, supprimerDeclencheur,
} from "./graphe";

export const ICONES: Record<TypeBloc, React.ElementType> = {
  texte: MessageSquareText, image: ImageIcon, video: Film, vocal: Mic, document: FileText, lien: LinkIcon,
  bouton_lien: ExternalLink, boutons: MousePointerClick, liste: List, position: MapPin, reaction: SmilePlus,
  pause: Timer, aller: CornerDownRight, agent: Bot, humain: UserRound, silence: BellOff, fin: CircleStop,
};

export const COULEURS: Record<Famille | "declencheur", string> = {
  message: "#6442E8", media: "#E0632B", interaction: "#1E9E5A", logique: "#7A7484", sortie: "#C2410C", declencheur: "#E0A43A",
};
const familleDe = (t: TypeBloc) => TYPES.find((x) => x.type === t)?.famille || "message";

type DonneesBloc = { bloc: Bloc; erreur: boolean; actif: boolean };
type DonneesDecl = { decl: Declencheur; actif: boolean };

const NoeudBloc = memo(function NoeudBloc({ data, selected }: NodeProps<Node<DonneesBloc>>) {
  const { bloc: b, erreur, actif } = data;
  const Icone = ICONES[b.type];
  const couleur = COULEURS[familleDe(b.type)];
  const sorties = sortiesDe(b);
  const libelle = TYPES.find((t) => t.type === b.type)?.libelle || b.type;
  return (
    <div className="pc-noeud" data-sel={selected || undefined} data-err={erreur || undefined} data-actif={actif || undefined}>
      <Handle type="target" position={Cote.Left} className="pc-entree" />
      <div className="flex items-start gap-2.5">
        <span className="pc-icone" style={{ background: couleur }}><Icone className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold" style={{ color: "#19171B" }}>{libelle}</p>
          <p className="truncate font-mono text-[10.5px]" style={{ color: "#9A95A3" }}>{b.id}</p>
        </div>
      </div>
      {resume(b) && <p className="pc-resume">{resume(b)}</p>}
      {sorties.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {sorties.map((s) => (
            <div key={s.id} className="relative flex h-[18px] items-center justify-end pr-1 text-[10.5px]" style={{ color: s.id === "sinon" ? "#A39DAD" : "#57525F" }}>
              {s.libelle && <span className="truncate">{s.libelle}</span>}
              <Handle type="source" id={s.id} position={Cote.Right} className="pc-sortie" style={{ top: "50%", right: -17 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const NoeudDeclencheur = memo(function NoeudDeclencheur({ data, selected }: NodeProps<Node<DonneesDecl>>) {
  return (
    <div className="pc-decl" data-sel={selected || undefined} data-actif={data.actif || undefined}>
      <span className="pc-icone" style={{ background: COULEURS.declencheur }}><Zap className="h-4 w-4" /></span>
      <span className="truncate text-[12.5px] font-semibold">{libelleDeclencheur(data.decl)}</span>
      <Handle type="source" id="suite" position={Cote.Right} className="pc-sortie" />
    </div>
  );
});

const TYPES_NOEUDS = { bloc: NoeudBloc, declencheur: NoeudDeclencheur };

export type PropsCanevas = {
  p: Parcours;
  erreurs: Set<string>;
  selection: string | null;
  actifs: Set<string>;
  onSelection: (id: string | null) => void;
  changer: (f: (q: Parcours) => void) => void;
};

function CanevasInterne({ p, erreurs, selection, actifs, onSelection, changer }: PropsCanevas) {
  const rf = useReactFlow();
  const [palette, setPalette] = useState(false);
  const positions = useMemo(() => disposer(p), [p]);

  const nodes: Node[] = useMemo(() => [
    ...p.declencheurs.map((d, i): Node<DonneesDecl> => {
      const id = `${PREFIXE_DECL}${i}`;
      return { id, type: "declencheur", position: positions[id] || { x: 0, y: i * 120 }, data: { decl: d, actif: actifs.has(id) }, selected: selection === id };
    }),
    ...p.blocs.map((b): Node<DonneesBloc> => ({
      id: b.id, type: "bloc", position: positions[b.id] || { x: 300, y: 0 },
      data: { bloc: b, erreur: erreurs.has(b.id), actif: actifs.has(b.id) }, selected: selection === b.id,
    })),
  ], [p, positions, erreurs, selection, actifs]);

  const edges: Edge[] = useMemo(() => liensDe(p).map((l) => ({
    id: `${l.de}|${l.sortie}|${l.vers}`,
    source: l.de, sourceHandle: l.sortie, target: l.vers,
    label: l.sortie.startsWith("choix:") ? undefined : l.libelle,
    animated: estDeclencheur(l.de) || (actifs.has(l.de) && actifs.has(l.vers)),
    style: { stroke: l.sortie === "sinon" ? "#C9C4D1" : "#8E89A3", strokeWidth: 1.6, strokeDasharray: l.sortie === "sinon" ? "5 4" : undefined },
  })), [p, actifs]);

  // React Flow mesure chaque nœud : on garde ses mesures entre deux
  // reconstructions, sinon les nœuds restent invisibles et les flèches absentes.
  const [rfNodes, setRfNodes] = useState<Node[]>(nodes);
  useEffect(() => {
    setRfNodes((avant) => nodes.map((n) => {
      const a = avant.find((x) => x.id === n.id);
      return a ? { ...n, measured: a.measured, width: a.width, height: a.height } : n;
    }));
  }, [nodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds));
    const suppressions = changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id);
    if (suppressions.length) {
      changer((q) => {
        const decl = suppressions.filter(estDeclencheur).map(indexDecl).sort((a, b) => b - a);
        for (const i of decl) supprimerDeclencheur(q, i);
        for (const id of suppressions.filter((x) => !estDeclencheur(x))) supprimerBloc(q, id);
      });
      onSelection(null);
    }
  }, [changer, onSelection]);

  // La position n'est écrite dans le parcours qu'au lâcher du bloc.
  const onNodeDragStop = useCallback((_: unknown, __: Node, deplaces: Node[]) => {
    changer((q) => {
      q.ui = { ...(q.ui || {}), positions: { ...disposer(q), ...(q.ui?.positions || {}) } };
      for (const n of deplaces) q.ui.positions![n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
    });
  }, [changer]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const enlevees = changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id);
    if (!enlevees.length) return;
    changer((q) => { for (const id of enlevees) { const [de, sortie] = id.split("|"); delier(q, de, sortie); } });
  }, [changer]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || estDeclencheur(c.target)) return;
    changer((q) => lier(q, c.source!, c.sourceHandle || "suite", c.target!));
  }, [changer]);

  const centre = () => {
    const sel = selection ? positions[selection] : null;
    if (sel) return { x: sel.x + 280, y: sel.y };
    const el = document.querySelector(".pc-canevas");
    const r = el?.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: (r?.left || 0) + (r?.width || 800) / 2, y: (r?.top || 0) + (r?.height || 600) / 2 });
  };

  function ajouter(type: TypeBloc | "declencheur") {
    const ou = centre();
    let nouveau = "";
    changer((q) => {
      q.ui = { ...(q.ui || {}), positions: { ...disposer(q), ...(q.ui?.positions || {}) } };
      if (type === "declencheur") {
        ajouterDeclencheur(q, { type: "mot_cle", mots: [], mode: "commence", vers: "" }, ou);
        nouveau = `${PREFIXE_DECL}${q.declencheurs.length - 1}`;
      } else {
        nouveau = ajouterBloc(q, type, ou, selection);
      }
    });
    setPalette(false);
    setTimeout(() => onSelection(nouveau), 0);
  }

  const familles: { f: Famille; titre: string }[] = [
    { f: "message", titre: "Messages" }, { f: "media", titre: "Médias" }, { f: "interaction", titre: "Interactions" },
    { f: "logique", titre: "Logique" }, { f: "sortie", titre: "Sorties" },
  ];

  return (
    <div className="pc-canevas relative h-full w-full">
      <ReactFlow
        nodes={rfNodes} edges={edges} nodeTypes={TYPES_NOEUDS}
        onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onNodeClick={(_, n) => onSelection(n.id)} onPaneClick={() => { onSelection(null); setPalette(false); }}
        deleteKeyCode={["Delete", "Backspace"]} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.15} maxZoom={1.6}
        proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#D6D1DE" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" nodeColor={(n) => (n.type === "declencheur" ? COULEURS.declencheur : COULEURS[familleDe((n.data as DonneesBloc).bloc.type)])} maskColor="rgba(244,242,247,0.7)" />
      </ReactFlow>

      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        <button className="pc-outil" title="Ajouter un bloc" onClick={() => setPalette((v) => !v)}><Plus className="h-5 w-5" /></button>
        <button className="pc-outil" title="Réorganiser" onClick={() => { changer((q) => { q.ui = { ...(q.ui || {}), positions: disposer(q, true) }; }); setTimeout(() => rf.fitView({ padding: 0.2 }), 50); }}>
          <LayoutGrid className="h-5 w-5" />
        </button>
      </div>

      {palette && (
        <div className="pc-palette absolute left-16 top-3 z-20 max-h-[calc(100%-24px)] w-[260px] overflow-y-auto rounded-[20px] bg-white p-3">
          <p className="px-2 pb-2 text-[12px]" style={{ color: "#8A8494" }}>
            {selection && !estDeclencheur(selection) ? `Ajouté après « ${selection} »` : "Ajouté au centre"}
          </p>
          <button className="pc-item" onClick={() => ajouter("declencheur")}>
            <span className="pc-icone" style={{ background: COULEURS.declencheur }}><Zap className="h-4 w-4" /></span> Déclencheur
          </button>
          {familles.map(({ f, titre }) => (
            <div key={f} className="mt-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#A39DAD" }}>{titre}</p>
              {TYPES.filter((t) => t.famille === f).map((t) => {
                const I = ICONES[t.type];
                return (
                  <button key={t.type} className="pc-item" onClick={() => ajouter(t.type)}>
                    <span className="pc-icone" style={{ background: COULEURS[f] }}><I className="h-4 w-4" /></span> {t.libelle}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        .pc-canevas .react-flow__node { cursor: grab; }
        .pc-noeud { width: 210px; border-radius: 16px; background: #fff; padding: 10px 12px; box-shadow: 0 1px 0 rgba(25,23,27,.04), 0 6px 18px rgba(25,23,27,.07); border: 1.5px solid #E7E3EE; transition: box-shadow .15s, border-color .15s; }
        .pc-noeud[data-sel] { border-color: #19171B; box-shadow: 0 8px 26px rgba(70,40,190,.18); }
        .pc-noeud[data-err] { border-color: #E3A595; }
        .pc-noeud[data-actif] { box-shadow: 0 0 0 4px rgba(37,211,102,.28), 0 6px 18px rgba(25,23,27,.07); }
        .pc-decl { display: flex; align-items: center; gap: 8px; width: 210px; padding: 8px 12px 8px 8px; border-radius: 999px; background: #FFF8EA; border: 1.5px solid #F2D9A6; color: #6B4A08; }
        .pc-decl[data-sel] { border-color: #19171B; }
        .pc-decl[data-actif] { box-shadow: 0 0 0 4px rgba(37,211,102,.28); }
        .pc-icone { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 10px; color: #fff; }
        .pc-resume { margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 11.5px; line-height: 1.35; color: #6B6773; white-space: pre-line; }
        .pc-entree, .pc-sortie { width: 11px !important; height: 11px !important; border: 2px solid #fff !important; background: #8E89A3 !important; }
        .pc-sortie:hover, .pc-entree:hover { background: #19171B !important; }
        .pc-outil { display: flex; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: 14px; background: #fff; color: #19171B; box-shadow: 0 4px 14px rgba(25,23,27,.12); }
        .pc-outil:hover { background: #19171B; color: #fff; }
        .pc-palette { box-shadow: 0 18px 40px rgba(25,23,27,.18); }
        .pc-item { display: flex; width: 100%; align-items: center; gap: 10px; border-radius: 12px; padding: 6px 8px; font-size: 13px; color: #19171B; text-align: left; }
        .pc-item:hover { background: #F4F2F7; }
        .pc-canevas .react-flow__edge-text { font-size: 10.5px; fill: #8A8494; }
        .pc-canevas .react-flow__controls { box-shadow: 0 4px 14px rgba(25,23,27,.12); border-radius: 12px; overflow: hidden; }
        .pc-canevas .react-flow__minimap { border-radius: 14px; overflow: hidden; box-shadow: 0 4px 14px rgba(25,23,27,.12); }
      `}</style>
    </div>
  );
}

export default function Canevas(props: PropsCanevas) {
  return (
    <ReactFlowProvider>
      <CanevasInterne {...props} />
    </ReactFlowProvider>
  );
}
