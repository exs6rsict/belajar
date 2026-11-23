import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import beatsData from "./beats.json";
import lyricsData from "./lyrics.json";

// ---------------------------------------------------------------------------
// Gaya: referensi @y6richo — kinetic typography 3D ala After Effects.
// Huruf kecil sans tebal dengan tracking rapat, glow putih, kata kunci
// di-extrude 3D ungu/oranye, kamera 3D bergerak, garis cahaya melesat.
// ---------------------------------------------------------------------------
const FONT = loadInterTight("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily;

const FPS = 30;
const W = 1080;
const H = 1920;

type Props = {
  audioFile: string;
  purple: string;
  orange: string;
  /** Teks muncul sedikit lebih awal dari vokal supaya terasa pas (detik). */
  lyricLead: number;
};

const defaultProps: Props = {
  audioFile: "impulsive.mp3",
  purple: "#a259ff",
  orange: "#ff8a2b",
  lyricLead: 0.05,
};

type Word = { w: string; t: number };
type Line = { t: number; end: number; text: string; words: Word[] };
const LINES = lyricsData.lines as Line[];
const BEATS = beatsData.beats as number[];
const STRENGTH = beatsData.strength as number[];
const DURATION = lyricsData.duration;

const CHORUS_START = LINES.find((l) => l.text.includes("don't think"))!.t;
const OUTRO_START = LINES[LINES.length - 1].t;

const ACCENT = new Set([
  "30", "nights", "crazy", "life", "advice", "right", "perfect", "might", "tonight",
  "think", "blink", "impulsive", "sorry", "runway", "something", "never",
]);
const clean = (w: string) => w.replace(/[^a-zA-Z0-9']/g, "").toLowerCase();
const isAccent = (w: string) => ACCENT.has(clean(w).replace(/'/g, ""));

export const MyComposition = () => (
  <Composition
    id="Impulsive"
    component={Impulsive}
    durationInFrames={Math.floor(DURATION * FPS)}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={defaultProps}
  />
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const beatInfo = (t: number) => {
  let i = -1;
  for (let k = 0; k < BEATS.length; k++) if (BEATS[k] <= t) i = k;
  if (i < 0) return { index: -1, since: 99, pulse: 0, strong: false };
  const since = t - BEATS[i];
  const s = STRENGTH[i] ?? 0.5;
  return { index: i, since, pulse: Math.exp(-since * 8) * (0.4 + s * 0.6), strong: s > 0.7 };
};

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

const textBase = (size: number): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 900,
  fontSize: size,
  letterSpacing: "-0.075em",
  lineHeight: 0.82,
  whiteSpace: "nowrap",
});

// ---------------------------------------------------------------------------
// 3D pieces
// ---------------------------------------------------------------------------
/** Teks timbul 3D: tumpukan layer di sumbu Z + muka depan bercahaya. */
const Extruded: React.FC<{ text: string; size: number; color: string; depth?: number }> = ({
  text,
  size,
  color,
  depth = 14,
}) => (
  <div style={{ position: "relative", transformStyle: "preserve-3d" }}>
    {[...Array(depth)].map((_, i) => (
      <div
        key={i}
        style={{
          ...textBase(size),
          position: i === 0 ? "relative" : "absolute",
          top: 0,
          left: 0,
          color: shade(color, 0.85 - (i / depth) * 0.6),
          transform: `translateZ(${-(depth - i) * 5}px)`,
        }}
      >
        {text}
      </div>
    ))}
    <div
      style={{
        ...textBase(size),
        position: "absolute",
        top: 0,
        left: 0,
        color: shade(color, 1.25),
        textShadow: `0 0 18px ${color}, 0 0 60px ${color}`,
      }}
    >
      {text}
    </div>
  </div>
);

/** Garis-garis cahaya yang melesat ke arah kamera. */
const Streaks: React.FC<{ t: number; boost: number; p: Props }> = ({ t, boost, p }) => {
  const N = 46;
  return (
    <AbsoluteFill style={{ perspective: 900, transformStyle: "preserve-3d" }}>
      {[...Array(N)].map((_, i) => {
        const span = 4200;
        const speed = 900 + random(`sp${i}`) * 900;
        const z = ((t * speed + random(`z${i}`) * span) % span) - 3600;
        const ang = random(`a${i}`) * Math.PI * 2;
        const rad = 300 + random(`r${i}`) * 900;
        const x = W / 2 + Math.cos(ang) * rad;
        const y = H / 2 + Math.sin(ang) * rad * 1.3;
        const col = i % 3 === 0 ? p.orange : i % 3 === 1 ? p.purple : "#ffffff";
        const len = 40 + random(`l${i}`) * 140 + boost * 160;
        const fade = interpolate(z, [-3600, -2600, 300, 600], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 5,
              height: len,
              borderRadius: 3,
              background: col,
              boxShadow: `0 0 14px ${col}`,
              opacity: fade * 0.85,
              transform: `translateZ(${z}px) rotateZ(${(ang * 180) / Math.PI + 90}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Satu "shot" per baris lirik
// ---------------------------------------------------------------------------
type Row = { words: (Word & { c: string; acc: boolean })[]; size: number };

const buildRows = (line: Line): Row[] => {
  const ws = line.words.map((w) => ({ ...w, c: clean(w.w), acc: isAccent(w.w) }));
  const rows: Row[] = [];
  let cur: Row["words"] = [];
  const flush = () => {
    if (!cur.length) return;
    const chars = cur.reduce((a, w) => a + w.c.length, 0) + (cur.length - 1);
    const size = Math.min(cur.length === 1 && cur[0].c.length <= 2 ? 150 : 330, (W - 260) / (Math.max(3, chars) * 0.52));
    rows.push({ words: cur, size });
    cur = [];
  };
  for (const w of ws) {
    if (w.acc) {
      flush();
      cur = [w];
      flush();
      continue;
    }
    const chars = cur.reduce((a, x) => a + x.c.length, 0);
    if (cur.length >= 3 || chars + w.c.length > 9) flush();
    cur.push(w);
  }
  flush();
  return rows;
};

const LineShot: React.FC<{ line: Line; idx: number; t: number; p: Props; pulse: number }> = ({
  line,
  idx,
  t,
  p,
  pulse,
}) => {
  const rows = React.useMemo(() => buildRows(line), [line]);
  const local = t - line.t;
  const len = Math.max(0.4, line.end - line.t);
  const k = Math.min(1, local / len);
  const color = idx % 2 === 0 ? p.purple : p.orange;
  const alt = idx % 2 === 0 ? p.orange : p.purple;

  // Kamera: putar & dolly sepanjang baris.
  const ry0 = (random(`ry${idx}`) - 0.5) * 30;
  const rx0 = (random(`rx${idx}`) - 0.5) * 24;
  const rz = (random(`rz${idx}`) - 0.5) * 14;
  const ease = Easing.out(Easing.cubic)(k);
  const ry = ry0 * (1 - ease * 0.7);
  const rx = rx0 * (1 - ease * 0.7);
  const dolly = interpolate(ease, [0, 1], [-250, 120]);
  // Whip masuk di awal shot.
  const whip = interpolate(local, [0, 0.12], [1, 0], { extrapolateRight: "clamp" });
  const outro = idx === LINES.length - 1 ? interpolate(t, [line.t, DURATION], [0, 1], { extrapolateRight: "clamp" }) : 0;

  const totalH = rows.reduce((a, r) => a + r.size * 0.92, 0);
  const align = ["flex-start", "center", "flex-end"][Math.floor(random(`al${idx}`) * 3)] as React.CSSProperties["alignItems"];

  // Kata yang paling baru muncul — dipakai untuk anotasi kecil.
  const latest = [...line.words].reverse().find((w) => w.t <= t);

  return (
    <AbsoluteFill
      style={{
        perspective: 1300,
        filter: `blur(${whip * 10 + outro * 8}px)`,
        opacity: 1 - outro,
      }}
    >
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transformStyle: "preserve-3d",
          transform: `translateZ(${dolly - outro * 900 + pulse * 60}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${1 + whip * 0.3})`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: align, transformStyle: "preserve-3d", width: W - 240, height: totalH, justifyContent: "center" }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: row.size * 0.2, transformStyle: "preserve-3d", marginTop: ri ? -row.size * 0.06 : 0 }}>
              {row.words.map((w, wi) => {
                const age = t - w.t;
                if (age < 0) return <span key={wi} style={{ ...textBase(row.size), visibility: "hidden" }}>{w.c}</span>;
                const isLatest = latest !== undefined && latest.t === w.t;
                const pop = interpolate(age, [0, 0.07, 0.16], [0, 1.12, 1], { extrapolateRight: "clamp" });
                const z = interpolate(age, [0, 0.12], [-700, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
                const blur = interpolate(age, [0, 0.1], [12, 0], { extrapolateRight: "clamp" });
                const inner = w.acc ? (
                  <Extruded text={w.c} size={row.size} color={color} />
                ) : (
                  <span
                    style={{
                      ...textBase(row.size),
                      color: "white",
                      opacity: isLatest ? 1 : 0.62,
                      textShadow: isLatest ? "0 0 14px rgba(255,255,255,0.9), 0 0 50px rgba(255,255,255,0.45)" : "0 0 10px rgba(255,255,255,0.3)",
                    }}
                  >
                    {w.c}
                  </span>
                );
                return (
                  <div
                    key={wi}
                    style={{
                      position: "relative",
                      transformStyle: "preserve-3d",
                      transform: `translateZ(${z}px) scale(${pop})`,
                      filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
                    }}
                  >
                    {/* Gema/trail saat kata kunci baru muncul */}
                    {w.acc && age < 0.35
                      ? [1, 2, 3].map((e) => (
                          <span
                            key={e}
                            style={{
                              ...textBase(row.size),
                              position: "absolute",
                              left: 0,
                              top: 0,
                              color: "transparent",
                              WebkitTextStroke: `2px ${color}`,
                              opacity: (1 - age / 0.35) * (0.6 - e * 0.15),
                              transform: `translateZ(${-e * 90}px) scale(${1 + e * 0.08})`,
                            }}
                          >
                            {w.c}
                          </span>
                        ))
                      : null}
                    {inner}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Anotasi kecil (seperti "mirror"/"man" di referensi) */}
        {latest ? (
          <div
            style={{
              ...textBase(64),
              position: "absolute",
              left: 120 + random(`an${idx}`) * 600,
              top: random(`at${idx}`) > 0.5 ? 380 : 1420,
              color: alt,
              textShadow: `0 0 16px ${alt}`,
              transform: `translateZ(220px) rotateY(${-ry * 0.5}deg)`,
              opacity: 0.9,
            }}
          >
            {clean(latest.w)}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export const Impulsive: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const tl = t + p.lyricLead; // waktu lirik (sedikit lebih awal)
  const b = beatInfo(t);
  const chorusAt = CHORUS_START - p.lyricLead;
  const inChorus = t >= chorusAt && t < OUTRO_START;

  const lineIdx = LINES.reduce((acc, l, i) => (l.t <= tl ? i : acc), -1);
  const line = lineIdx >= 0 ? LINES[lineIdx] : null;

  // Guncangan kecil di setiap ketukan.
  const sh = b.pulse * (inChorus ? 16 : 9);
  const sx = (random(`sx${frame}`) - 0.5) * sh;
  const sy = (random(`sy${frame}`) - 0.5) * sh;

  // Kilatan bingkai ungu (seperti frame ungu di referensi).
  const frameFlash = (inChorus && b.strong && b.index % 4 === 0 ? 1 : 0) * Math.exp(-b.since * 10);
  const chorusHit = t >= chorusAt ? Math.exp(-(t - chorusAt) * 6) : 0;

  const fadeOut = interpolate(t, [DURATION - 0.6, DURATION], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#050507", overflow: "hidden", opacity: fadeOut }}>
      <Audio src={staticFile(p.audioFile)} />

      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 55%, ${shade(p.purple, 0.22)} 0%, transparent 60%)`, opacity: 0.5 + b.pulse * 0.5 }} />
      <Streaks t={t} boost={b.pulse + (inChorus ? 0.4 : 0)} p={p} />

      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        {line ? <LineShot key={lineIdx} line={line} idx={lineIdx} t={tl} p={p} pulse={b.pulse} /> : null}
      </AbsoluteFill>

      {/* Bingkai ungu + layar ungu saat masuk chorus */}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 0 ${70 * frameFlash}px ${p.purple}`, opacity: frameFlash }} />
      <AbsoluteFill style={{ backgroundColor: p.purple, opacity: chorusHit * 0.85, mixBlendMode: "screen" }} />

      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.85) 100%)" }} />
    </AbsoluteFill>
  );
};
