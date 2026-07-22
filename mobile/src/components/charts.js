import React from "react";
import { View } from "react-native";
import Svg, { Rect, Path, Circle, G, Line, Text as SvgText } from "react-native-svg";
import { C } from "../theme";

// Bar chart type "Fulfillment Performance" — barres fines, une surlignée en lime.
export function BarChart({ data = [], height = 120, highlightIdx = -1 }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  const n = Math.max(1, data.length);
  const gap = 6;
  const W = 300;
  const bw = (W - gap * (n - 1)) / n;
  const hi = highlightIdx >= 0 ? highlightIdx : data.reduce((a, d, i, arr) => (d.v > arr[a].v ? i : a), 0);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = Math.max(3, (d.v / max) * (height - 26));
        const x = i * (bw + gap);
        const y = height - bh - 18;
        const on = i === hi;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={bw} height={bh} rx={3}
              fill={on ? C.lime : "rgba(255,255,255,0.14)"} />
            {on && (
              <G>
                <Rect x={x - bw * 0.6} y={y - 22} width={bw * 2.2} height={16} rx={8} fill={C.lime} />
                <SvgText x={x + bw / 2} y={y - 10} fontSize="9" fontWeight="700"
                  fill="#101012" textAnchor="middle">{d.v}</SvgText>
              </G>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// Jauge semi-circulaire type "Sales Overview" avec gros nombre au centre.
export function Gauge({ value = 0, max = 100, size = 220 }) {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 16;
  const start = Math.PI;         // 180°
  const end = 2 * Math.PI;       // 360°
  const frac = Math.max(0, Math.min(1, value / (max || 1)));
  const ang = start + frac * (end - start);
  const pt = (a, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const arc = (a0, a1, rr = r) => {
    const [x0, y0] = pt(a0, rr);
    const [x1, y1] = pt(a1, rr);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${rr} ${rr} 0 ${large} 1 ${x1} ${y1}`;
  };
  const [hx, hy] = pt(ang);
  return (
    <Svg width={size} height={size * 0.62}>
      <Path d={arc(start, end)} stroke="rgba(255,255,255,0.12)" strokeWidth="14" fill="none" strokeLinecap="round" />
      <Path d={arc(start, ang)} stroke={C.lime} strokeWidth="14" fill="none" strokeLinecap="round" />
      <Circle cx={hx} cy={hy} r="7" fill={C.white} />
      <Circle cx={hx} cy={hy} r="3.5" fill={C.lime} />
    </Svg>
  );
}

// Sparkline pour les mini-cartes.
export function Spark({ data = [], color = C.lime, width = 90, height = 30 }) {
  const max = Math.max(1, ...data);
  const min = Math.min(...data, 0);
  const n = data.length || 1;
  const pts = data.map((v, i) => {
    const x = (i / (n - 1 || 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * height;
    return `${x},${y}`;
  });
  return (
    <Svg width={width} height={height}>
      <Path d={`M ${pts.join(" L ")}`} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
