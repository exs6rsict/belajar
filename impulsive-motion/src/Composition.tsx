import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Composition,
  interpolate,
  random,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Anton";
import { loadFont as loadMono } from "@remotion/google-fonts/SpaceMono";

const { fontFamily: DISPLAY } = loadFont("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: MONO } = loadMono("normal", { weights: ["700"], subsets: ["latin"] });

// ---------------------------------------------------------------------------
// Props — ubah di Remotion Studio (panel kanan) tanpa menyentuh kode.
// ---------------------------------------------------------------------------
type Props = {
  /** Nama file audio di folder public/, mis. "impulsive.mp3". Kosongkan jika belum ada. */
  audioFile: string;
  /** Detik mulai potongan lagu (mis. bagian drop). */
  audioStartSec: number;
  /** Tempo lagu. Semua efek (zoom, flash, ganti kata) dikunci ke ketukan ini. */
  bpm: number;
  /** Panjang video dalam detik. */
  durationSec: number;
  /** Kata-kata yang muncul bergantian, satu per ketukan. */
  words: string[];
  title: string;
  credit: string;
  accent: string;
};

const FPS = 30;

const defaultProps: Props = {
  audioFile: "",
  audioStartSec: 0,
  bpm: 128,
  durationSec: 15,
  words: ["NO", "BRAKES", "JUST", "FEEL", "IT", "RIGHT", "NOW", "ALL", "IN"],
  title: "IMPULSIVE",
  credit: "THEKIDZN",
  accent: "#ff1f3d",
};

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.durationSec * FPS)),
});

export const MyComposition = () => (
  <Composition
    id="Impulsive"
    component={Impulsive}
    durationInFrames={15 * FPS}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={defaultProps}
    calculateMetadata={calculateMetadata}
  />
);

// ---------------------------------------------------------------------------
// Beat helpers
// ---------------------------------------------------------------------------
const useBeat = (bpm: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerBeat = (60 / bpm) * fps;
  const beatFloat = frame / framesPerBeat;
  const beat = Math.floor(beatFloat);
  const phase = beatFloat - beat; // 0 → 1 di dalam satu ketukan
  // Pulse tajam di awal ketukan lalu meluruh (eksponensial).
  const pulse = Math.exp(-phase * 6);
  return { frame, framesPerBeat, beat, phase, pulse };
};

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.35, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`n${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#n${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

const ScanLines: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        "repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, transparent 2px, transparent 5px)",
      pointerEvents: "none",
    }}
  />
);

const Rings: React.FC<{ bpm: number; accent: string }> = ({ bpm, accent }) => {
  const { frame, pulse } = useBeat(bpm);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {[0, 1, 2, 3].map((i) => {
        const size = 420 + i * 220 + pulse * 60;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: "50%",
              border: `${i === 0 ? 10 : 3}px ${i % 2 ? "dashed" : "solid"} ${
                i === 0 ? accent : "rgba(255,255,255,0.35)"
              }`,
              transform: `rotate(${frame * (i % 2 ? -1.2 : 0.8) * (i + 1)}deg)`,
              opacity: 0.25 + pulse * 0.6,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const GlitchText: React.FC<{
  text: string;
  size: number;
  accent: string;
  glitch: number; // 0..1
  seed: number;
}> = ({ text, size, accent, glitch, seed }) => {
  const dx = (random(`x${seed}`) - 0.5) * 60 * glitch;
  const dy = (random(`y${seed}`) - 0.5) * 20 * glitch;
  const split = 6 + glitch * 22;
  const base: React.CSSProperties = {
    position: "absolute",
    fontFamily: DISPLAY,
    fontWeight: 400,
    fontSize: size,
    letterSpacing: -2,
    lineHeight: 0.9,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
  // Potongan horizontal acak saat glitch tinggi.
  const sliceTop = random(`s${seed}`) * 70;
  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <span style={{ ...base, color: accent, transform: `translate(${-split + dx}px, ${dy}px)`, mixBlendMode: "screen" }}>
        {text}
      </span>
      <span style={{ ...base, color: "#00e5ff", transform: `translate(${split + dx}px, ${-dy}px)`, mixBlendMode: "screen" }}>
        {text}
      </span>
      <span style={{ ...base, color: "white", transform: `translate(${dx * 0.3}px, 0)` }}>{text}</span>
      {glitch > 0.4 ? (
        <span
          style={{
            ...base,
            color: "white",
            clipPath: `inset(${sliceTop}% 0 ${100 - sliceTop - 12}% 0)`,
            transform: `translateX(${dx * 2.5}px)`,
          }}
        >
          {text}
        </span>
      ) : null}
      {/* spacer agar container punya ukuran */}
      <span style={{ ...base, position: "relative", visibility: "hidden" }}>{text}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
const Intro: React.FC<Props> = ({ title, credit, accent, bpm }) => {
  const { frame, pulse, beat } = useBeat(bpm);
  const { durationInFrames } = useVideoConfig();
  const letters = title.split("");
  const reveal = interpolate(frame, [0, durationInFrames * 0.6], [0, letters.length], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 40 }}>
      <div style={{ display: "flex", transform: `scale(${1 + pulse * 0.08})` }}>
        {letters.map((l, i) => {
          const on = reveal > i;
          return (
            <span
              key={i}
              style={{
                fontFamily: DISPLAY,
                fontSize: 170,
                color: on ? "white" : "transparent",
                WebkitTextStroke: on ? "0" : "3px rgba(255,255,255,0.5)",
                transform: `translateY(${on ? 0 : 40}px)`,
                display: "inline-block",
              }}
            >
              {l}
            </span>
          );
        })}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 44,
          letterSpacing: 18,
          color: accent,
          opacity: beat % 2 === 0 ? 1 : 0.4,
        }}
      >
        ▶ {credit}
      </div>
    </AbsoluteFill>
  );
};

const WordStorm: React.FC<Props> = ({ words, accent, bpm }) => {
  const { beat, pulse } = useBeat(bpm);
  const word = words.length ? words[beat % words.length] : "";
  const glitch = pulse > 0.6 ? pulse : 0;
  const rot = (random(`r${beat}`) - 0.5) * 14;
  const shakeX = (random(`sx${beat}-${Math.round(pulse * 10)}`) - 0.5) * 30 * pulse;
  const size = word.length > 5 ? 230 : 330;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        transform: `translateX(${shakeX}px) rotate(${rot}deg) scale(${1 + pulse * 0.35})`,
      }}
    >
      <GlitchText text={word} size={size} accent={accent} glitch={glitch} seed={beat} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<Props> = ({ title, credit, accent, bpm }) => {
  const { frame, pulse } = useBeat(bpm);
  const { durationInFrames } = useVideoConfig();
  const fade = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: fade }}>
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 120 + i * 250,
            fontFamily: DISPLAY,
            fontSize: 200,
            color: i === 3 ? "white" : "transparent",
            WebkitTextStroke: i === 3 ? "0" : `2px ${i % 2 ? accent : "rgba(255,255,255,0.4)"}`,
            whiteSpace: "nowrap",
            transform: `translateX(${(i % 2 ? -1 : 1) * (frame * 12 - 400)}px) scale(${i === 3 ? 1 + pulse * 0.15 : 1})`,
          }}
        >
          {title} {title} {title}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          fontFamily: MONO,
          fontSize: 40,
          letterSpacing: 14,
          color: "white",
        }}
      >
        {credit}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export const Impulsive: React.FC<Props> = (props) => {
  const { bpm, accent, audioFile, audioStartSec } = props;
  const { frame, beat, pulse, framesPerBeat } = useBeat(bpm);
  const { durationInFrames, fps } = useVideoConfig();

  const introLen = Math.round(framesPerBeat * 8);
  const outroLen = Math.round(framesPerBeat * 8);
  const stormLen = Math.max(1, durationInFrames - introLen - outroLen);

  // Background strobe: hitam ↔ aksen tiap 4 ketukan (downbeat), plus flash putih.
  const downbeat = beat % 4 === 0;
  const bg = downbeat && pulse > 0.5 ? accent : "#070707";
  const flash = downbeat ? pulse * 0.9 : 0;

  // Zoom punch global + sedikit drift kamera.
  const cam = 1 + pulse * 0.04 + Math.sin(frame / 40) * 0.01;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      {audioFile ? (
        <Audio src={staticFile(audioFile)} trimBefore={Math.round(audioStartSec * fps)} />
      ) : null}

      <AbsoluteFill style={{ transform: `scale(${cam})` }}>
        <Rings bpm={bpm} accent={accent} />

        <Sequence durationInFrames={introLen} name="Intro">
          <Intro {...props} />
        </Sequence>
        <Sequence from={introLen} durationInFrames={stormLen} name="Word storm">
          <WordStorm {...props} />
        </Sequence>
        <Sequence from={introLen + stormLen} name="Outro">
          <Outro {...props} />
        </Sequence>
      </AbsoluteFill>

      {/* Letterbox bars */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 90, background: "black" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 90, background: "black" }} />

      <ScanLines />
      <Grain />
      <AbsoluteFill style={{ backgroundColor: "white", opacity: flash, pointerEvents: "none" }} />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.85) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
