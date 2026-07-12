// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/stats/page.tsx — Statistiques complètes — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter }                from "next/navigation";
import { motion, AnimatePresence }  from "framer-motion";
import {
  TrendingUp, MessageCircle, Users, UserPlus, Zap,
  Clock, AlertTriangle, BarChart2, Activity, Calendar,
  ChevronDown, Download, RefreshCw, ArrowUp, ArrowDown,
  Minus, Bot, Sparkles, Target, Award, Flame,
} from "lucide-react";
import { useAuth }    from "@/hooks/useAuth";
import { useAgents }  from "@/hooks/useAgents";
import { cn }         from "@/lib/utils";
import { getPlanLabel } from "@/lib/plans";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyStat {
  date:            string;
  messages:        number;
  leads:           number;
  escalations:     number;
  avg_response_ms: number | null;
  tokens:          number;
}

interface MonthlyToken {
  period:           string;
  total_tokens:     number;
  prompt_tokens:    number;
  completion_tokens: number;
}

interface HourSlot  { hour: number; count: number; }
interface DowSlot   { dow: number; label: string; count: number; }

interface AgentStat {
  id:               string;
  name:             string;
  emoji:            string;
  status:           string;
  plan:             string;
  sector:           string;
  activeCaps:       number;
  period_messages:  number;
  period_leads:     number;
  period_escalations: number;
  period_tokens:    number;
  avg_response_ms:  number | null;
  active_days:      number;
  token_used_month: number;
  token_limit:      number;
  token_unlimited:  boolean;
  token_percent:    number;
}

interface StatsData {
  period:  string;
  from:    string;
  to:      string;
  overview: {
    total_messages:    number;
    unique_contacts:   number;
    total_leads:       number;
    total_escalations: number;
    escalation_rate:   number;
    lead_conversion:   number;
    total_tokens:      number;
    avg_response_ms:   number | null;
    avg_conv_length:   number;
    max_conv_length:   number;
    peak_day:          string | null;
    peak_day_messages: number;
    peak_hour:         number | null;
    peak_hour_count:   number;
  };
  daily_series:        DailyStat[];
  monthly_tokens:      MonthlyToken[];
  hourly_distribution: HourSlot[];
  dow_distribution:    DowSlot[];
  agents:              AgentStat[];
  empty?:              boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS = [
  { id: "7d",  label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "90d", label: "3 mois" },
  { id: "6m",  label: "6 mois" },
  { id: "12m", label: "12 mois" },
] as const;

const SECTOR_LABELS: Record<string, string> = {
  ecommerce: "E-commerce", hospitality: "Hôtellerie", healthcare: "Santé",
  finance: "Finance", education: "Éducation", real_estate: "Immobilier",
  legal: "Juridique", beauty_wellness: "Beauté", food_beverage: "Restauration",
  tech_saas: "Tech/SaaS", consulting: "Conseil", nonprofit: "Associatif", other: "Autre",
};

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number, compact = false): string {
  if (compact && n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (compact && n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000)   return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}h`;
}

// ── SVG Line / Area Chart ─────────────────────────────────────────────────────

interface ChartSeries {
  key:    string;
  color:  string;
  label:  string;
  filled: boolean;
}

function LineChart({
  data, series, width = 600, height = 160, xKey = "date",
}: {
  data:   Record<string, number | string>[];
  series: ChartSeries[];
  width?: number;
  height?: number;
  xKey?:  string;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-xs" style={{ color: "var(--text-disabled)" }}>Aucune donnée pour cette période</p>
    </div>
  );

  const PAD = { t: 12, r: 8, b: 28, l: 40 };
  const W   = width  - PAD.l - PAD.r;
  const H   = height - PAD.t - PAD.b;

  const allValues = series.flatMap((s) => data.map((d) => Number(d[s.key] ?? 0)));
  const maxVal    = Math.max(...allValues, 1);

  const px = (i: number) => PAD.l + (i / (data.length - 1)) * W;
  const py = (v: number) => PAD.t + H - (v / maxVal) * H;

  function makePath(key: string): string {
    if (data.length === 1) {
      const x = px(0); const y = py(Number(data[0][key] ?? 0));
      return `M ${x} ${y}`;
    }
    return data.map((d, i) => {
      const x = px(i);
      const y = py(Number(d[key] ?? 0));
      if (i === 0) return `M ${x} ${y}`;
      const px0 = px(i - 1); const py0 = py(Number(data[i - 1][key] ?? 0));
      const cpx = (px0 + x) / 2;
      return `C ${cpx} ${py0}, ${cpx} ${y}, ${x} ${y}`;
    }).join(" ");
  }

  function makeArea(key: string): string {
    const line = makePath(key);
    const lastX = px(data.length - 1);
    const baseY = PAD.t + H;
    return `${line} L ${lastX} ${baseY} L ${PAD.l} ${baseY} Z`;
  }

  const labelEvery = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseMove={(e) => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const relX  = (e.clientX - rect.left) / rect.width * width;
          const idx   = Math.round(((relX - PAD.l) / W) * (data.length - 1));
          const clamped = Math.max(0, Math.min(data.length - 1, idx));
          setTooltip({ x: px(clamped), y: height / 2, idx: clamped });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          {series.filter((s) => s.filled).map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.t + H * t;
          return (
            <g key={t}>
              <line x1={PAD.l} y1={y} x2={width - PAD.r} y2={y}
                stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />
              <text x={PAD.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-disabled)">
                {fmtNum(Math.round(maxVal * (1 - t)), true)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => i % labelEvery === 0 && (
          <text key={i} x={px(i)} y={height - 4} textAnchor="middle" fontSize="8" fill="var(--text-disabled)">
            {fmtDate(String(d[xKey]))}
          </text>
        ))}

        {/* Area fills */}
        {series.filter((s) => s.filled).map((s) => (
          <path key={`area-${s.key}`} d={makeArea(s.key)} fill={`url(#grad-${s.key})`} />
        ))}

        {/* Lines */}
        {series.map((s) => (
          <path key={`line-${s.key}`} d={makePath(s.key)}
            fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Dots at tooltip */}
        {tooltip && series.map((s) => {
          const v = Number(data[tooltip.idx]?.[s.key] ?? 0);
          return (
            <circle key={`dot-${s.key}`} cx={px(tooltip.idx)} cy={py(v)} r="3"
              fill={s.color} stroke="var(--bg-elevated)" strokeWidth="1.5" />
          );
        })}

        {/* Tooltip vertical line */}
        {tooltip && (
          <line x1={px(tooltip.idx)} y1={PAD.t} x2={px(tooltip.idx)} y2={PAD.t + H}
            stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3 2" />
        )}
      </svg>

      {/* Tooltip card */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            style={{
              position: "absolute",
              top: 8,
              left: `clamp(8px, ${(px(tooltip.idx) / width) * 100}%, calc(100% - 120px))`,
              transform: "translateX(-50%)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "6px 10px",
              pointerEvents: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              minWidth: 110,
              zIndex: 10,
            }}
          >
            <p className="text-[9px] font-semibold mb-1" style={{ color: "var(--text-disabled)" }}>
              {fmtDate(String(data[tooltip.idx][xKey]))}
            </p>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-[9px]" style={{ color: "var(--text-disabled)" }}>{s.label}</span>
                </div>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {fmtNum(Number(data[tooltip.idx][s.key] ?? 0))}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({
  data, valueKey, labelKey, color = "var(--color-gold)",
  height = 120, maxBars = 30,
}: {
  data:     Record<string, number | string>[];
  valueKey: string;
  labelKey: string;
  color?:   string;
  height?:  number;
  maxBars?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayData = data.slice(-maxBars);
  const maxVal = Math.max(...displayData.map((d) => Number(d[valueKey] ?? 0)), 1);

  if (!displayData.length) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-xs" style={{ color: "var(--text-disabled)" }}>Aucune donnée</p>
    </div>
  );

  return (
    <div className="flex items-end gap-px w-full" style={{ height }}>
      {displayData.map((d, i) => {
        const val = Number(d[valueKey] ?? 0);
        const pct = (val / maxVal) * 100;
        const isHov = hovered === i;
        return (
          <div key={i} className="relative flex-1 flex flex-col items-center group"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            style={{ height: "100%" }}>
            {/* Tooltip */}
            {isHov && (
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap
                px-2 py-1 rounded text-[9px] font-semibold"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                {String(d[labelKey])}<br />
                <span style={{ color }}>{fmtNum(val)}</span>
              </div>
            )}
            <div className="w-full flex-1 flex items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, val > 0 ? 2 : 0)}%` }}
                transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.008 }}
                className="w-full rounded-t-sm transition-opacity duration-100"
                style={{
                  background: isHov ? color : `${color}88`,
                  minHeight: val > 0 ? 2 : 0,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Hourly Heatmap ────────────────────────────────────────────────────────────

function HourlyHeatmap({ data }: { data: HourSlot[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const PERIODS_OF_DAY = [
    { label: "Nuit",       hours: [0,1,2,3,4,5],    color: "#A78BFA" },
    { label: "Matin",      hours: [6,7,8,9,10,11],   color: "#34D399" },
    { label: "Après-midi", hours: [12,13,14,15,16,17], color: "#FBBF24" },
    { label: "Soir",       hours: [18,19,20,21,22,23], color: "#F87171" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-24 gap-0.5" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
        {data.map((slot) => {
          const intensity = slot.count / maxCount;
          const periodColor = PERIODS_OF_DAY.find((p) => p.hours.includes(slot.hour))?.color ?? "#7C5AF8";
          const isHov = hovered === slot.hour;
          return (
            <div key={slot.hour} className="relative flex flex-col items-center gap-0.5 cursor-default"
              onMouseEnter={() => setHovered(slot.hour)}
              onMouseLeave={() => setHovered(null)}>
              {isHov && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap
                  px-2 py-1 rounded text-[9px] font-semibold"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                    color: "var(--text-primary)", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                  {fmtHour(slot.hour)}<br />
                  <span style={{ color: periodColor }}>{slot.count} msgs</span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: slot.hour * 0.015, duration: 0.3 }}
                className="w-full rounded-sm"
                style={{
                  height: 32,
                  background: slot.count === 0
                    ? "var(--bg-muted)"
                    : `${periodColor}${Math.round(intensity * 220 + 35).toString(16).padStart(2, "0")}`,
                  border: isHov ? `1px solid ${periodColor}` : "1px solid transparent",
                  transform: `scaleY(${0.2 + intensity * 0.8})`,
                  transformOrigin: "bottom",
                }}
              />
              {slot.hour % 6 === 0 && (
                <span className="text-[7px] tabular-nums" style={{ color: "var(--text-disabled)" }}>
                  {fmtHour(slot.hour)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 justify-end">
        {PERIODS_OF_DAY.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
            <span className="text-[9px]" style={{ color: "var(--text-disabled)" }}>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DoW Bar (Day of Week) ─────────────────────────────────────────────────────

function DowChart({ data }: { data: DowSlot[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-20">
      {data.map((slot) => {
        const pct = (slot.count / maxCount) * 100;
        const isWeekend = slot.dow === 0 || slot.dow === 6;
        return (
          <div key={slot.dow} className="flex-1 flex flex-col items-center gap-1">
            <p className="text-[9px] tabular-nums font-bold" style={{ color: "var(--text-disabled)" }}>
              {slot.count > 0 ? fmtNum(slot.count, true) : ""}
            </p>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(pct, slot.count > 0 ? 8 : 2)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full rounded-t-md"
              style={{
                background: isWeekend ? "#A78BFA66" : "rgba(124,90,248,0.5)",
                minHeight: slot.count > 0 ? 4 : 2,
              }}
            />
            <p className="text-[9px] font-semibold" style={{ color: slot.count > 0 ? "var(--text-tertiary)" : "var(--text-disabled)" }}>
              {slot.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, color = "var(--color-gold)", height = 32 }: {
  values: number[]; color?: string; height?: number;
}) {
  if (values.length < 2) return null;
  const maxV = Math.max(...values, 1);
  const w    = 80;
  const h    = height;
  const step = w / (values.length - 1);
  const pts  = values.map((v, i) => `${i * step},${h - (v / maxV) * h}`).join(" ");
  const area = `0,${h} ${pts} ${(values.length - 1) * step},${h}`;
  const last  = values[values.length - 1];
  const prev  = values[values.length - 2];
  const delta = last - prev;

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="flex-shrink-0">
        <defs>
          <linearGradient id={`sp-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#sp-grad-${color.replace(/[^a-zA-Z0-9]/g, "")})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {delta !== 0 && (
        <span className="text-[9px] font-bold flex items-center gap-0.5" style={{ color: delta > 0 ? "#34D399" : "#f87171" }}>
          {delta > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
        </span>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color = "var(--color-gold)",
  trend, sparkValues, accent = false,
}: {
  icon:        React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label:       string;
  value:       string | number;
  sub?:        string;
  color?:      string;
  trend?:      "up" | "down" | "neutral";
  sparkValues?: number[];
  accent?:     boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: accent ? `${color}08` : "var(--bg-elevated)",
        border: `1px solid ${accent ? `${color}22` : "var(--border-subtle)"}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <Icon className="w-4 h-4" style={{ color } as React.CSSProperties} />
        </div>
        {trend && trend !== "neutral" && (
          <span className="text-[9px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
            style={{
              background: trend === "up" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
              color:      trend === "up" ? "#34D399" : "#f87171",
            }}>
            {trend === "up" ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
          </span>
        )}
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums leading-none" style={{ color: accent ? color : "var(--text-primary)" }}>
          {typeof value === "number" ? fmtNum(value) : value}
        </p>
        <p className="text-[10px] mt-1 font-medium" style={{ color: "var(--text-disabled)" }}>{label}</p>
        {sub && <p className="text-[9px] mt-0.5" style={{ color: "var(--text-disabled)" }}>{sub}</p>}
      </div>
      {sparkValues && sparkValues.length > 1 && (
        <Sparkline values={sparkValues} color={color} />
      )}
    </motion.div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, subtitle, icon: Icon, children, actions }: {
  title:    string;
  subtitle?: string;
  icon:     React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "rgba(124,90,248,0.1)" }}>
            <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
            {subtitle && (
              <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Chart toggle button ───────────────────────────────────────────────────────

function ChartToggle({
  options, value, onChange,
}: {
  options: { id: string; label: string }[];
  value:   string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="px-2.5 py-1 text-[10px] font-semibold transition-colors duration-100"
          style={{
            background: value === o.id ? "rgba(124,90,248,0.12)" : "transparent",
            color: value === o.id ? "var(--color-gold)" : "var(--text-disabled)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Agent comparison table ────────────────────────────────────────────────────

function AgentCompare({ agents, period }: { agents: AgentStat[]; period: string }) {
  const [sortKey, setSortKey] = useState<keyof AgentStat>("period_messages");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  function toggleSort(key: keyof AgentStat) {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...agents].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const COLS: Array<{ key: keyof AgentStat; label: string; fmt: (v: AgentStat) => string }> = [
    { key: "period_messages",  label: "Messages",     fmt: (a) => fmtNum(a.period_messages) },
    { key: "period_leads",     label: "Leads",        fmt: (a) => fmtNum(a.period_leads) },
    { key: "avg_response_ms",  label: "Tps réponse",  fmt: (a) => fmtMs(a.avg_response_ms) },
    { key: "period_escalations", label: "Escalades",  fmt: (a) => fmtNum(a.period_escalations) },
    { key: "token_percent",    label: "Tokens %",     fmt: (a) => a.token_unlimited ? "∞" : `${a.token_percent}%` },
    { key: "active_days",      label: "Jours actifs", fmt: (a) => `${a.active_days}j` },
  ];

  if (agents.length === 0) return (
    <p className="text-xs text-center py-6" style={{ color: "var(--text-disabled)" }}>
      Aucun agent configuré.
    </p>
  );

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full border-collapse text-xs" style={{ minWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <th className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-disabled)" }}>Agent</th>
            {COLS.map((c) => (
              <th key={c.key}
                className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none"
                style={{ color: sortKey === c.key ? "var(--color-gold)" : "var(--text-disabled)" }}
                onClick={() => toggleSort(c.key)}>
                <span className="flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key
                    ? (sortDir === "desc"
                      ? <ArrowDown className="w-2.5 h-2.5" />
                      : <ArrowUp className="w-2.5 h-2.5" />)
                    : <Minus className="w-2.5 h-2.5 opacity-30" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a, i) => (
            <motion.tr key={a.id} layout
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">{a.emoji}</span>
                  <div>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(124,90,248,0.1)", color: "var(--color-gold)" }}>
                        {getPlanLabel(a.plan)}
                      </span>
                      <span className="text-[9px]" style={{ color: "var(--text-disabled)" }}>
                        {SECTOR_LABELS[a.sector] ?? a.sector}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              {COLS.map((c) => {
                const val = c.fmt(a);
                const isTokenCol = c.key === "token_percent";
                return (
                  <td key={c.key} className="py-2.5 px-3 tabular-nums text-right">
                    {isTokenCol && !a.token_unlimited ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold" style={{ color: a.token_percent >= 90 ? "#f87171" : a.token_percent >= 70 ? "#fbbf24" : "var(--text-primary)" }}>
                          {val}
                        </span>
                        <div className="w-16 h-1 rounded-full" style={{ background: "var(--bg-muted)" }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${a.token_percent}%`, background: a.token_percent >= 90 ? "#f87171" : a.token_percent >= 70 ? "#fbbf24" : "var(--color-gold)" }} />
                        </div>
                      </div>
                    ) : (
                      <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{val}</span>
                    )}
                  </td>
                );
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Insight badge ─────────────────────────────────────────────────────────────

function Insight({ icon: Icon, color, label, value }: {
  icon:  React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon className="w-3.5 h-3.5" style={{ color } as React.CSSProperties} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{label}</p>
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const router             = useRouter();
  const { isLoggedIn }     = useAuth();
  const { agents: allAgents, loading: agentsLoading } = useAgents();
  const token = typeof window !== "undefined" ? localStorage.getItem("camille_token") : null;

  const [period,      setPeriod]      = useState<string>("30d");
  const [agentId,     setAgentId]     = useState<string>("all");
  const [data,        setData]        = useState<StatsData | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [agentDropOpen, setAgentDropOpen] = useState(false);

  // Chart metric selectors
  const [activityMetric, setActivityMetric] = useState<"messages" | "leads" | "tokens">("messages");

  useEffect(() => { if (!isLoggedIn) router.replace("/login"); }, [isLoggedIn, router]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (agentId !== "all") params.set("agentId", agentId);
      const res = await fetch(`/api/stats?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [token, period, agentId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const ov = data?.overview;
  const ds = data?.daily_series ?? [];
  const mt = data?.monthly_tokens ?? [];

  // Sparkline values (last 7 days of daily series, messages)
  const sparkMessages = ds.slice(-7).map((d) => d.messages);
  const sparkLeads    = ds.slice(-7).map((d) => d.leads);
  const sparkTokens   = ds.slice(-7).map((d) => d.tokens);

  // Activity chart data filtered by metric
  const ACTIVITY_SERIES: Record<string, ChartSeries[]> = {
    messages: [
      { key: "messages", color: "var(--color-gold)", label: "Messages", filled: true },
      { key: "leads",    color: "#34D399",            label: "Leads",    filled: false },
    ],
    leads: [
      { key: "leads",       color: "#34D399", label: "Leads",    filled: true  },
      { key: "escalations", color: "#f87171", label: "Escalades",filled: false },
    ],
    tokens: [
      { key: "tokens", color: "#A78BFA", label: "Tokens", filled: true },
    ],
  };

  // Best performing agent
  const bestAgent = data?.agents?.reduce<AgentStat | null>((best, a) =>
    !best || a.period_messages > best.period_messages ? a : best, null);

  const selectedAgentLabel = agentId === "all"
    ? "Tous les agents"
    : allAgents.find((a) => a.id === agentId)?.identity.name ?? "Agent";

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-7 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <BarChart2 className="w-5 h-5" style={{ color: "var(--color-gold)" }} />
              Statistiques
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-disabled)" }}>
              Analysez les performances de vos agents WhatsApp et adaptez votre stratégie.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Agent selector */}
            <div className="relative">
              <button
                onClick={() => setAgentDropOpen((v) => !v)}
                onBlur={() => setTimeout(() => setAgentDropOpen(false), 150)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">{selectedAgentLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
              </button>
              <AnimatePresence>
                {agentDropOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full mt-1 right-0 z-20 rounded-lg overflow-hidden py-1"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 180 }}
                  >
                    {[{ id: "all", name: "Tous les agents", emoji: "📊" },
                      ...allAgents.map((a) => ({ id: a.id, name: a.identity.name, emoji: a.identity.avatar_emoji ?? "🤖" }))
                    ].map((opt) => (
                      <button key={opt.id}
                        onClick={() => { setAgentId(opt.id); setAgentDropOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors hover:bg-[var(--surface-glass)]"
                        style={{ color: agentId === opt.id ? "var(--color-gold)" : "var(--text-secondary)" }}
                      >
                        <span>{opt.emoji}</span>
                        <span className="font-medium truncate">{opt.name}</span>
                        {agentId === opt.id && <span className="ml-auto text-[8px]">✓</span>}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Period selector */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
              {PERIODS.map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className="px-3 py-2 text-xs font-medium transition-colors duration-100"
                  style={{
                    background: period === p.id ? "rgba(124,90,248,0.12)" : "var(--bg-elevated)",
                    color: period === p.id ? "var(--color-gold)" : "var(--text-disabled)",
                    borderRight: p.id !== "12m" ? "1px solid var(--border-subtle)" : undefined,
                  }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Refresh + Export */}
            <button onClick={fetchStats}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--surface-glass)]"
              style={{ border: "1px solid var(--border-subtle)", color: "var(--text-disabled)" }}
              title="Actualiser">
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── Loading overlay ─────────────────────────────────────────────────── */}
        {(loading || agentsLoading) && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--color-gold)" }} />
              <p className="text-xs" style={{ color: "var(--text-disabled)" }}>Chargement des statistiques…</p>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* ── KPI Strip ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                icon={MessageCircle}
                label="Messages traités"
                value={ov?.total_messages ?? 0}
                sub={`sur ${PERIODS.find((p) => p.id === period)?.label}`}
                color="var(--color-gold)"
                accent
                sparkValues={sparkMessages}
              />
              <KpiCard
                icon={Users}
                label="Contacts uniques"
                value={ov?.unique_contacts ?? 0}
                sub="conversations ouvertes"
                color="#60A5FA"
                sparkValues={undefined}
              />
              <KpiCard
                icon={UserPlus}
                label="Leads capturés"
                value={ov?.total_leads ?? 0}
                sub={ov?.lead_conversion ? `${ov.lead_conversion}% taux de conv.` : undefined}
                color="#34D399"
                sparkValues={sparkLeads}
              />
              <KpiCard
                icon={Clock}
                label="Temps de réponse"
                value={fmtMs(ov?.avg_response_ms ?? null)}
                sub="moyenne pondérée"
                color="#A78BFA"
              />
              <KpiCard
                icon={Zap}
                label="Tokens consommés"
                value={fmtNum(ov?.total_tokens ?? 0, true)}
                sub="période sélectionnée"
                color="#FBBF24"
                sparkValues={sparkTokens}
              />
              <KpiCard
                icon={AlertTriangle}
                label="Taux d'escalade"
                value={`${ov?.escalation_rate ?? 0}%`}
                sub={`${ov?.total_escalations ?? 0} escalades`}
                color={ov && ov.escalation_rate > 10 ? "#f87171" : "#34D399"}
                trend={ov && ov.escalation_rate > 10 ? "up" : "down"}
              />
            </div>

            {/* ── Insights rapides ───────────────────────────────────────────── */}
            {ov && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Insight icon={Flame} color="#FBBF24" label="Jour record"
                  value={ov.peak_day ? `${fmtDate(ov.peak_day)} · ${fmtNum(ov.peak_day_messages)} msgs` : "—"} />
                <Insight icon={Activity} color="#A78BFA" label="Heure de pointe"
                  value={ov.peak_hour !== null ? `${fmtHour(ov.peak_hour)} · ${fmtNum(ov.peak_hour_count)} msgs` : "—"} />
                <Insight icon={MessageCircle} color="#60A5FA" label="Longueur moy. convers."
                  value={ov.avg_conv_length > 0 ? `${ov.avg_conv_length} messages / contact` : "—"} />
                {bestAgent && (
                  <Insight icon={Award} color="#34D399" label="Agent le + actif"
                    value={`${bestAgent.emoji} ${bestAgent.name} · ${fmtNum(bestAgent.period_messages)} msgs`} />
                )}
              </div>
            )}

            {/* ── Activité quotidienne ────────────────────────────────────────── */}
            <Section title="Activité quotidienne"
              subtitle={`Évolution sur les ${PERIODS.find((p) => p.id === period)?.label.toLowerCase()}`}
              icon={Activity}
              actions={
                <ChartToggle
                  options={[
                    { id: "messages", label: "Messages" },
                    { id: "leads",    label: "Leads" },
                    { id: "tokens",   label: "Tokens" },
                  ]}
                  value={activityMetric}
                  onChange={(v) => setActivityMetric(v as typeof activityMetric)}
                />
              }
            >
              <div className="space-y-3">
                <LineChart
                  data={ds as unknown as Record<string, number | string>[]}
                  series={ACTIVITY_SERIES[activityMetric]}
                  height={180}
                />
                {/* Legend */}
                <div className="flex items-center gap-4">
                  {ACTIVITY_SERIES[activityMetric].map((s) => (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: s.color }} />
                      <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── Token consumption par mois ──────────────────────────────────── */}
            {mt.length > 0 && (
              <Section title="Consommation de tokens" subtitle="Historique mensuel · prompt + complétion" icon={Zap}>
                <div className="space-y-4">
                  <BarChart
                    data={mt as unknown as Record<string, number | string>[]}
                    valueKey="total_tokens"
                    labelKey="period"
                    color="#A78BFA"
                    height={100}
                  />
                  {/* Monthly breakdown table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          {["Mois","Total tokens","Prompt","Complétion","Ratio"].map((h) => (
                            <th key={h} className="py-2 text-[10px] font-semibold uppercase tracking-wider text-left pr-6 last:pr-0"
                              style={{ color: "var(--text-disabled)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...mt].reverse().map((row, i) => {
                          const ratio = row.total_tokens > 0
                            ? Math.round((row.prompt_tokens / row.total_tokens) * 100)
                            : 0;
                          return (
                            <tr key={row.period}
                              style={{ borderBottom: i < mt.length - 1 ? "1px solid var(--border-subtle)" : undefined }}>
                              <td className="py-2 pr-6 font-semibold" style={{ color: "var(--text-primary)" }}>
                                {row.period}
                              </td>
                              <td className="py-2 pr-6 font-bold tabular-nums" style={{ color: "var(--color-gold)" }}>
                                {fmtNum(row.total_tokens, true)}
                              </td>
                              <td className="py-2 pr-6 tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                                {fmtNum(row.prompt_tokens, true)}
                              </td>
                              <td className="py-2 pr-6 tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                                {fmtNum(row.completion_tokens, true)}
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${ratio}%`, background: "#A78BFA" }} />
                                  </div>
                                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-disabled)" }}>
                                    {ratio}% prompt
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            )}

            {/* ── Répartition temporelle ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Activité par heure" subtitle="Distribution des messages entrants (24h)" icon={Clock}>
                <HourlyHeatmap data={data.hourly_distribution} />
              </Section>

              <Section title="Activité par jour" subtitle="Répartition sur la semaine" icon={Calendar}>
                <div className="space-y-3">
                  <DowChart data={data.dow_distribution} />
                  {/* Insights */}
                  {(() => {
                    const peakDow = data.dow_distribution.reduce((b, d) => d.count > b.count ? d : b, data.dow_distribution[0]);
                    const quietDow = data.dow_distribution.reduce((b, d) => d.count > 0 && d.count < b.count ? d : b,
                      data.dow_distribution.find((d) => d.count > 0) ?? data.dow_distribution[0]);
                    return (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="rounded-lg p-3 text-center"
                          style={{ background: "rgba(124,90,248,0.06)", border: "1px solid rgba(124,90,248,0.15)" }}>
                          <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--text-disabled)" }}>Jour le + actif</p>
                          <p className="text-sm font-bold" style={{ color: "var(--color-gold)" }}>{peakDow?.label ?? "—"}</p>
                          <p className="text-[9px]" style={{ color: "var(--text-disabled)" }}>{fmtNum(peakDow?.count ?? 0)} messages</p>
                        </div>
                        <div className="rounded-lg p-3 text-center"
                          style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
                          <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--text-disabled)" }}>Jour le + calme</p>
                          <p className="text-sm font-bold" style={{ color: "#60A5FA" }}>{quietDow?.label ?? "—"}</p>
                          <p className="text-[9px]" style={{ color: "var(--text-disabled)" }}>{fmtNum(quietDow?.count ?? 0)} messages</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Section>
            </div>

            {/* ── Performance & taux ─────────────────────────────────────────── */}
            {ov && (
              <Section title="Indicateurs de performance" subtitle="Qualité du service et conversion" icon={Target}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {
                      label:   "Taux d'escalade",
                      value:   `${ov.escalation_rate}%`,
                      desc:    `${ov.total_escalations} transferts humains`,
                      color:   ov.escalation_rate > 15 ? "#f87171" : ov.escalation_rate > 5 ? "#fbbf24" : "#34D399",
                      sub:     ov.escalation_rate <= 5 ? "Excellent" : ov.escalation_rate <= 15 ? "Correct" : "À améliorer",
                    },
                    {
                      label:   "Taux de conversion lead",
                      value:   `${ov.lead_conversion}%`,
                      desc:    `${ov.total_leads} leads / ${ov.unique_contacts} contacts`,
                      color:   ov.lead_conversion >= 15 ? "#34D399" : ov.lead_conversion >= 5 ? "#fbbf24" : "#f87171",
                      sub:     ov.lead_conversion >= 15 ? "Excellent" : ov.lead_conversion >= 5 ? "Bon" : "À optimiser",
                    },
                    {
                      label:   "Msgs / conversation",
                      value:   ov.avg_conv_length > 0 ? `${ov.avg_conv_length}` : "—",
                      desc:    `max ${ov.max_conv_length} échanges`,
                      color:   "#A78BFA",
                      sub:     ov.avg_conv_length >= 5 ? "Engagement fort" : "Engagement faible",
                    },
                    {
                      label:   "Temps de réponse",
                      value:   fmtMs(ov.avg_response_ms),
                      desc:    ov.avg_response_ms ? "temps moyen" : "aucune donnée",
                      color:   "#60A5FA",
                      sub:     ov.avg_response_ms && ov.avg_response_ms < 2000 ? "Ultra-rapide" : ov.avg_response_ms && ov.avg_response_ms < 5000 ? "Normal" : "Lent",
                    },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl p-4 flex flex-col gap-2"
                      style={{ background: `${kpi.color}08`, border: `1px solid ${kpi.color}20` }}>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{kpi.label}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-disabled)" }}>{kpi.desc}</p>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full self-start"
                        style={{ background: `${kpi.color}18`, color: kpi.color }}>
                        {kpi.sub}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Comparaison agents ──────────────────────────────────────────── */}
            {data.agents.length > 0 && (
              <Section
                title={data.agents.length === 1 ? "Détail de l'agent" : `Comparaison · ${data.agents.length} agents`}
                subtitle="Classement par performance · cliquez sur une colonne pour trier"
                icon={Bot}
              >
                <AgentCompare agents={data.agents} period={period} />
              </Section>
            )}

            {/* ── Token burn rate ─────────────────────────────────────────────── */}
            {data.agents.some((a) => !a.token_unlimited) && (
              <Section title="Utilisation des quotas tokens" subtitle="Avancement mois en cours par agent" icon={Sparkles}>
                <div className="space-y-3">
                  {data.agents.filter((a) => !a.token_unlimited).map((a) => {
                    const pct   = a.token_percent;
                    const color = pct >= 90 ? "#f87171" : pct >= 70 ? "#fbbf24" : "var(--color-gold)";
                    // Days remaining in month
                    const now      = new Date();
                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    const daysPassed  = now.getDate();
                    const daysLeft    = daysInMonth - daysPassed;
                    const dailyBurn   = daysPassed > 0 ? Math.round(a.token_used_month / daysPassed) : 0;
                    const projectedUse = a.token_used_month + dailyBurn * daysLeft;
                    const willExceed  = projectedUse > a.token_limit;
                    return (
                      <div key={a.id} className="space-y-2 p-3 rounded-lg"
                        style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{a.emoji}</span>
                            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(124,90,248,0.1)", color: "var(--color-gold)" }}>
                              {getPlanLabel(a.plan)}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold tabular-nums" style={{ color }}>
                              {fmtNum(a.token_used_month, true)} / {fmtNum(a.token_limit, true)}
                            </p>
                            <p className="text-[9px]" style={{ color: "var(--text-disabled)" }}>{pct}% utilisé</p>
                          </div>
                        </div>
                        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-card)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, pct)}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ background: color }}
                          />
                          {/* Projected line */}
                          {dailyBurn > 0 && projectedUse <= a.token_limit * 1.3 && (
                            <div className="absolute top-0 h-full w-0.5 opacity-50"
                              style={{
                                left: `${Math.min(100, (projectedUse / a.token_limit) * 100)}%`,
                                background: willExceed ? "#f87171" : "#34D399",
                              }}
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[9px]"
                          style={{ color: "var(--text-disabled)" }}>
                          <span>Rythme : {fmtNum(dailyBurn, true)} tokens/jour</span>
                          <span className={willExceed ? "font-bold" : ""} style={{ color: willExceed ? "#f87171" : "var(--text-disabled)" }}>
                            Projection fin de mois : {fmtNum(Math.min(projectedUse, a.token_limit * 2), true)}
                            {willExceed && " ⚠️ Dépassement prévu"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* ── Recommandations stratégiques ───────────────────────────────── */}
            {ov && (
              <Section title="Recommandations" subtitle="Conseils pour optimiser vos performances" icon={Target}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ov.escalation_rate > 15 && {
                      color: "#f87171",
                      icon: AlertTriangle,
                      title: "Trop d'escalades vers des humains",
                      text: `Votre taux d'escalade est de ${ov.escalation_rate}%. Enrichissez la base de connaissances de votre agent avec les questions fréquentes non résolues.`,
                    },
                    ov.lead_conversion < 5 && ov.unique_contacts > 10 && {
                      color: "#FBBF24",
                      icon: UserPlus,
                      title: "Conversion leads trop faible",
                      text: `Seulement ${ov.lead_conversion}% de vos contacts deviennent des leads. Activez la capture de leads et ajoutez un call-to-action dans le prompt système.`,
                    },
                    ov.avg_conv_length < 3 && ov.unique_contacts > 5 && {
                      color: "#60A5FA",
                      icon: MessageCircle,
                      title: "Conversations trop courtes",
                      text: "Les échanges se terminent rapidement. Configurez des questions de suivi et activez la mémoire de conversation pour un meilleur engagement.",
                    },
                    ov.peak_hour !== null && {
                      color: "#34D399",
                      icon: Clock,
                      title: `Pic d'activité à ${fmtHour(ov.peak_hour)}`,
                      text: `Votre agent est plus sollicité à ${fmtHour(ov.peak_hour)}. Assurez-vous que les réponses sont optimisées pour cette tranche horaire.`,
                    },
                    ov.total_messages === 0 && {
                      color: "#A78BFA",
                      icon: Bot,
                      title: "Aucun message sur la période",
                      text: "Votre agent n'a traité aucun message. Vérifiez que la connexion WhatsApp est active et que le numéro est bien configuré.",
                    },
                    data.agents.some((a) => !a.token_unlimited && a.token_percent >= 80) && {
                      color: "#f87171",
                      icon: Zap,
                      title: "Quota tokens proche de la limite",
                      text: "Un ou plusieurs de vos agents approchent leur quota mensuel. Envisagez un upgrade de plan pour éviter une interruption de service.",
                    },
                  ].filter(Boolean).slice(0, 4).map((rec, i) => {
                    if (!rec) return null;
                    const Icon = rec.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-xl"
                        style={{ background: `${rec.color}08`, border: `1px solid ${rec.color}20` }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${rec.color}15` }}>
                          <Icon className="w-4 h-4" style={{ color: rec.color } as React.CSSProperties} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{rec.title}</p>
                          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-disabled)" }}>{rec.text}</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Always show a positive one if everything is good */}
                  {ov.total_messages > 0 && ov.escalation_rate <= 5 && ov.lead_conversion >= 10 && (
                    <div className="flex items-start gap-3 p-4 rounded-xl sm:col-span-2"
                      style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(52,211,153,0.15)" }}>
                        <Award className="w-4 h-4" style={{ color: "#34D399" }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Performances excellentes 🎉</p>
                        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                          Taux d'escalade {ov.escalation_rate}% · Conversion leads {ov.lead_conversion}%.
                          Votre agent fonctionne de manière optimale. Continuez à enrichir sa base de connaissances pour maintenir ce niveau.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !agentsLoading && data?.empty && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
              <BarChart2 className="w-5 h-5" style={{ color: "var(--text-disabled)" }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Aucun agent configuré</p>
              <p className="text-xs" style={{ color: "var(--text-disabled)" }}>
                Créez votre premier agent pour commencer à collecter des statistiques.
              </p>
            </div>
            <button onClick={() => router.push("/configure")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold hover:brightness-110 transition-all"
              style={{ background: "rgba(124,90,248,0.1)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.2)" }}>
              <Bot className="w-3.5 h-3.5" />
              Créer un agent
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
