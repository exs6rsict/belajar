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
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as loadGlitch } from "@remotion/google-fonts/RubikGlitch";
import { loadFont as loadWet } from "@remotion/google-fonts/RubikWetPaint";
import { loadFont as loadMono } from "@remotion/google-fonts/SpaceMono";
import beatsData from "./beats.json";
import lyricsData from "./lyrics.json";

// ---------------------------------------------------------------------------
// Fonts (dipilih dari referensi Pinterest: poster "I don't think, I don't blink"
// yang pakai huruf kuas kuning + cipratan cat merah, plus kinetic type condensed)
// ---------------------------------------------------------------------------
const ANTON = loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const MARKER = loadMarker("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const GLITCH = loadGlitch("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const WET = loadWet("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const MONO = loadMono("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily;

const FPS = 30;
const W = 1080;

type Props = {
  audioFile: string;
  yellow: string;
  red: string;
  ink: string;
};

const defaultProps: Props = {
  audioFile: "impulsive.mp3",
  yellow: "#ffe500",
  red: "#ff2b4a",
  ink: "#0b0b0b",
};

type Word = { w: string; t: number };
type Line = { t: number; end: number; text: string; words: Word[] };
const LINES = lyricsData.lines as Line[];
const BEATS = beatsData.beats as number[];
const STRENGTH = beatsData.strength as number[];
const DURATION = lyricsData.duration;

// Bagian lagu (detik, relatif ke potongan).
const CHORUS_START = LINES.find((l) => l.text.includes("don't think"))!.t;
const PRE_START = LINES.find((l) => l.text.startsWith("I ain't never"))!.t;
const OUTRO_START = LINES[LINES.length - 1].t;

const ACCENT = new Set([
  "30", "NIGHTS", "CRAZY", "LIFE", "ADVICE", "RIGHT", "PERFECT", "MIGHT",
  "THINK", "BLINK", "IMPULSIVE", "SORRY", "RUNWAY", "SOMETHING", "TONIGHT",
]);
const clean = (w: string) => w.replace(/[^a-zA-Z0-9']/g, "").toUpperCase();
const isAccent = (w: string) => ACCENT.has(clean(w).replace(/'/g, ""));

export const MyComposition = () => (
  <Composition
    id="Impulsive"
    component={Impulsive}
    durationInFrames={Math.floor(DURATION * FPS)}
    fps={FPS}
    width={W}
    height={1920}
    defaultProps={defaultProps}
  />
);

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------
const useTime = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

const beatInfo = (t: number) => {
  let i = -1;
  for (let k = 0; k < BEATS.length; k++) if (BEATS[k] <= t) i = k;
  if (i < 0) return { index: -1, since: 99, pulse: 0, strong: false, strength: 0 };
  const since = t - BEATS[i];
  const strength = STRENGTH[i] ?? 0.5;
  return {
    index: i,
    since,
    pulse: Math.exp(-since * 7) * (0.45 + strength * 0.55),
    strong: strength > 0.7,
    strength,
  };
};

const fitSize = (word: string, max: number, widthFactor: number, avail = W - 120) =>
  Math.min(max, avail / Math.max(1, word.length * widthFactor));

// ---------------------------------------------------------------------------
// Texture layers
// ---------------------------------------------------------------------------
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.4 }}>
      <svg width="100%" height="100%">
        <filter id={`grain${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Filter SVG untuk huruf "meleleh/terdistorsi" seperti poster referensi. */
const WarpDefs: React.FC<{ seed: number; scale: number }> = ({ seed, scale }) => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <filter id="warp" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.035" numOctaves={2} seed={seed} />
      <feDisplacementMap in="SourceGraphic" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="rough">
      <feTurbulence type="turbulence" baseFrequency="0.6" numOctaves={1} seed={seed} />
      <feDisplacementMap in="SourceGraphic" scale={6} />
    </filter>
  </svg>
);

/** Cipratan cat: blob + tetesan + titik-titik. Deterministik via seed. */
const Splat: React.FC<{ seed: number; color: string; size: number; grow: number }> = ({
  seed,
  color,
  size,
  grow,
}) => {
  const r = (k: string) => random(`${seed}-${k}`);
  const blobs = [...Array(9)].map((_, i) => {
    const a = r(`a${i}`) * Math.PI * 2;
    const d = r(`d${i}`) * 0.22;
    return { x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d, rr: 0.08 + r(`r${i}`) * 0.12 };
  });
  const drips = [...Array(5)].map((_, i) => ({
    x: 0.3 + r(`dx${i}`) * 0.4,
    w: 0.015 + r(`dw${i}`) * 0.025,
    h: 0.15 + r(`dh${i}`) * 0.35,
  }));
  const dots = [...Array(26)].map((_, i) => {
    const a = r(`ta${i}`) * Math.PI * 2;
    const d = 0.28 + r(`td${i}`) * 0.25;
    return { x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d, rr: 0.004 + r(`tr${i}`) * 0.02 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 1 1" style={{ overflow: "visible" }}>
      <g transform={`translate(0.5 0.5) scale(${grow}) translate(-0.5 -0.5)`}>
        {blobs.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.rr} fill={color} />
        ))}
        {drips.map((d, i) => (
          <rect key={i} x={d.x} y={0.5} width={d.w} height={d.h * Math.min(1, grow)} rx={d.w / 2} fill={color} />
        ))}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.rr} fill={color} />
        ))}
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Lyric scenes
// ---------------------------------------------------------------------------

/** Verse: kata menumpuk vertikal, font condensed, kata baru "slam" masuk. */
const StackLine: React.FC<{ line: Line; t: number; p: Props; variant: number }> = ({ line, t, p, variant }) => {
  const shown = line.words.filter((w) => w.t <= t);
  const maxLen = Math.max(...line.words.map((w) => clean(w.w).length));
  const size = fitSize("X".repeat(maxLen), 300, 0.47);
  const tilt = variant % 2 ? -4 : 3;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: variant % 3 === 0 ? "flex-start" : "center", transform: `rotate(${tilt}deg)`, width: W - 120 }}>
        {shown.map((w, i) => {
          const age = t - w.t;
          const isLast = i === shown.length - 1;
          const slam = interpolate(age, [0, 0.12], [1.9, 1], { extrapolateRight: "clamp" });
          const blur = interpolate(age, [0, 0.1], [14, 0], { extrapolateRight: "clamp" });
          const acc = isAccent(w.w);
          const word = clean(w.w);
          return (
            <div
              key={i}
              style={{
                fontFamily: ANTON,
                fontSize: acc ? size * 1.15 : size,
                lineHeight: 0.86,
                color: acc ? p.yellow : isLast ? "white" : "transparent",
                WebkitTextStroke: !acc && !isLast ? "3px rgba(255,255,255,0.75)" : undefined,
                transform: `scale(${slam})`,
                filter: `blur(${blur}px)`,
                textShadow: acc ? `8px 8px 0 ${p.red}` : undefined,
                whiteSpace: "nowrap",
              }}
            >
              {word}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Build-up: satu kata raksasa, glitch RGB, makin ngebut menjelang chorus. */
const SlamWord: React.FC<{ line: Line; t: number; p: Props; intensity: number }> = ({ line, t, p, intensity }) => {
  const cur = [...line.words].reverse().find((w) => w.t <= t);
  if (!cur) return null;
  const age = t - cur.t;
  const word = clean(cur.w);
  const size = fitSize(word, 520, 0.5);
  const hit = Math.exp(-age * 9);
  const sp = (6 + hit * 30) * intensity;
  const jx = (random(`jx${cur.t}`) - 0.5) * 50 * hit;
  const base: React.CSSProperties = {
    position: "absolute",
    fontFamily: ANTON,
    fontSize: size,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: `translateX(${jx}px) scale(${1 + hit * 0.5})` }}>
      <span style={{ ...base, color: p.red, transform: `translateX(${-sp}px)`, mixBlendMode: "screen" }}>{word}</span>
      <span style={{ ...base, color: "#00e5ff", transform: `translateX(${sp}px)`, mixBlendMode: "screen" }}>{word}</span>
      <span style={{ ...base, color: "white" }}>{word}</span>
    </AbsoluteFill>
  );
};

/** Chorus: gaya poster Pinterest — kuas kuning terdistorsi, baris miring bergantian. */
const PosterLine: React.FC<{ line: Line; t: number; p: Props; lineIdx: number }> = ({ line, t, p, lineIdx }) => {
  const CW = 0.74; // perkiraan lebar huruf Permanent Marker (em)
  const words = line.words.map((w) => ({ ...w, c: clean(w.w) }));
  const maxW = W - 200;
  const layout = (size: number) => {
    const rows: (typeof words)[] = [[]];
    let cur = 0;
    for (const w of words) {
      const ww = w.c.length * size * CW + size * 0.3;
      if (cur + ww > maxW && rows[rows.length - 1].length) {
        rows.push([]);
        cur = 0;
      }
      rows[rows.length - 1].push(w);
      cur += ww;
    }
    return rows;
  };
  let size = 230;
  let rows = layout(size);
  while (size > 90 && (rows.length * size * 1.32 > 1300 || rows.some((r) => r.some((w) => w.c.length * size * CW > maxW)))) {
    size -= 8;
    rows = layout(size);
  }
  const lh = size * 1.32;
  const top = 960 - (rows.length * lh) / 2;
  return (
    <AbsoluteFill style={{ filter: "url(#warp)" }}>
      {rows.map((row, ri) => {
        const rot = (ri % 2 ? 2.5 : -4) + (random(`rr${lineIdx}-${ri}`) - 0.5) * 2;
        const offX = 70 + random(`rx${lineIdx}-${ri}`) * 80;
        return (
          <div
            key={ri}
            style={{
              position: "absolute",
              top: top + ri * lh,
              left: offX,
              display: "flex",
              gap: size * 0.3,
              transform: `rotate(${rot}deg)`,
              transformOrigin: "center center",
            }}
          >
            {row.map((w, i) => {
              if (w.t > t) return <span key={i} style={{ fontFamily: MARKER, fontSize: size, visibility: "hidden" }}>{w.c}</span>;
              const age = t - w.t;
              const isImp = w.c === "IMPULSIVE";
              const isSorry = w.c === "SORRY";
              const pop = interpolate(age, [0, 0.08, 0.2], [0.3, 1.3, 1], { extrapolateRight: "clamp" });
              return (
                <span
                  key={i}
                  style={{
                    fontFamily: isImp ? GLITCH : isSorry ? WET : MARKER,
                    fontSize: isImp || isSorry ? size * 1.05 : size,
                    lineHeight: 1,
                    color: isImp ? "white" : isSorry ? p.red : p.yellow,
                    textShadow: isImp ? `6px 6px 0 ${p.red}, -4px -4px 0 #00e5ff` : isSorry ? `5px 5px 0 ${p.yellow}` : undefined,
                    display: "inline-block",
                    transform: `scale(${pop})`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {w.c}
                </span>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Outro "I'm on something": melayang, blur, fade. */
const OutroLine: React.FC<{ line: Line; t: number; p: Props }> = ({ line, t, p }) => {
  const k = interpolate(t, [line.t, DURATION], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shown = line.words.filter((w) => w.t <= t).map((w) => clean(w.w));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - k * 0.9 }}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            fontFamily: MARKER,
            fontSize: 150,
            color: i === 0 ? p.yellow : "transparent",
            WebkitTextStroke: i === 0 ? undefined : `2px rgba(255,229,0,${0.5 - i * 0.09})`,
            transform: `scale(${1 + k * 0.6 + i * k * 0.25}) rotate(${-6 + i * k * 4}deg)`,
            filter: `blur(${k * 6 + i * k * 2}px)`,
            whiteSpace: "nowrap",
          }}
        >
          {shown.join(" ")}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export const Impulsive: React.FC<Props> = (p) => {
  const t = useTime();
  const b = beatInfo(t);
  const inChorus = t >= CHORUS_START && t < OUTRO_START;
  const inPre = t >= PRE_START && t < CHORUS_START;

  const lineIdx = LINES.reduce((acc, l, i) => (l.t <= t ? i : acc), -1);
  const line = lineIdx >= 0 ? LINES[lineIdx] : null;

  // Build-up: getaran & zoom naik menjelang chorus.
  const pre = inPre ? interpolate(t, [PRE_START, CHORUS_START], [0, 1]) : 0;
  const shake = (b.pulse * 14 + pre * 22) * (inChorus ? 1.6 : 1);
  const sx = (random(`sx${Math.floor(t * 30)}`) - 0.5) * shake;
  const sy = (random(`sy${Math.floor(t * 30)}`) - 0.5) * shake;
  const cam = 1 + b.pulse * 0.06 + pre * 0.15;

  // Background: hitam; chorus dapat kilatan merah di kick kuat.
  const redFlash = inChorus && b.strong ? b.pulse : 0;
  const whiteFlash = (b.strong ? b.pulse * 0.35 : 0) + (Math.abs(t - CHORUS_START) < 0.15 ? 0.9 : 0);

  // Cipratan cat menumpuk tiap kick kuat di chorus.
  const splats = BEATS.map((bt, i) => ({ bt, i }))
    .filter(({ bt, i }) => bt >= CHORUS_START - 0.05 && bt <= t && STRENGTH[i] > 0.7)
    .slice(-4);

  const outroFade = interpolate(t, [DURATION - 0.8, DURATION], [1, 0], { extrapolateLeft: "clamp" });

  let scene: React.ReactNode = null;
  if (line) {
    if (t >= OUTRO_START) scene = <OutroLine line={line} t={t} p={p} />;
    else if (inChorus) scene = <PosterLine line={line} t={t} p={p} lineIdx={lineIdx} />;
    else if (inPre) scene = <SlamWord line={line} t={t} p={p} intensity={1 + pre * 2} />;
    else if (lineIdx % 3 === 2) scene = <SlamWord line={line} t={t} p={p} intensity={1} />;
    else scene = <StackLine line={line} t={t} p={p} variant={lineIdx} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: p.ink, overflow: "hidden", opacity: outroFade }}>
      <Audio src={staticFile(p.audioFile)} />
      <WarpDefs seed={Math.max(0, b.index)} scale={inChorus ? 10 + b.pulse * 28 : 0} />

      <AbsoluteFill style={{ backgroundColor: p.red, opacity: redFlash * 0.85 }} />

      {/* Garis-garis kecepatan di belakang (verse) */}
      {!inChorus ? (
        <AbsoluteFill style={{ opacity: 0.18 }}>
          {[...Array(14)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: (i / 14) * 1920,
                left: ((t * 900 * (1 + (i % 3))) % 2400) - 1200,
                width: 600 + (i % 4) * 200,
                height: 4,
                background: i % 5 === 0 ? p.yellow : "white",
              }}
            />
          ))}
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${cam})` }}>
        {splats.map(({ bt, i }, k) => {
          const grow = interpolate(t - bt, [0, 0.12], [0.3, 1], { extrapolateRight: "clamp" });
          const size = 380 + random(`ss${i}`) * 320;
          const side = i % 2 ? W - size * 0.55 : -size * 0.45;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: side,
                top: 150 + random(`st${i}`) * 1400,
                opacity: (k === splats.length - 1 ? 0.95 : 0.7) * (t >= OUTRO_START ? 0.35 : 1),
                transform: `rotate(${random(`sr${i}`) * 360}deg)`,
              }}
            >
              <Splat seed={i} color={p.red} size={size} grow={grow} />
            </div>
          );
        })}
        {scene}
      </AbsoluteFill>

      {/* HUD kecil ala edit TikTok */}
      <div style={{ position: "absolute", top: 130, left: 70, right: 70, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 30, color: "white", opacity: 0.85, letterSpacing: 4 }}>
        <span>({"IMPULSIVE"})</span>
        <span style={{ color: p.yellow }}>THEKIDSZN</span>
      </div>
      <div style={{ position: "absolute", bottom: 130, left: 70, right: 70, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 26, color: "white", opacity: 0.7 }}>
        <span>{line ? line.text.toUpperCase() : ""}</span>
      </div>
      <div style={{ position: "absolute", bottom: 90, left: 70, right: 70, height: 4, background: "rgba(255,255,255,0.2)" }}>
        <div style={{ width: `${(t / DURATION) * 100}%`, height: "100%", background: p.yellow }} />
      </div>

      <Grain />
      <AbsoluteFill style={{ backgroundColor: "white", opacity: Math.min(0.9, whiteFlash) }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.8) 100%)" }} />
    </AbsoluteFill>
  );
};
