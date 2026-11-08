type Tone = { chip: string; dot: string };

const TONES: Record<string, Tone> = {
  red: { chip: "bg-red-500/12 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  amber: { chip: "bg-amber-500/14 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  lime: { chip: "bg-lime-500/14 text-lime-800 dark:text-lime-300", dot: "bg-lime-500" },
  emerald: {
    chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  teal: { chip: "bg-teal-500/12 text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  sky: { chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  indigo: { chip: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  violet: { chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  pink: { chip: "bg-pink-500/12 text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
  neutral: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

function hueOf(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function labelTone(color: string | null): Tone {
  if (!color) return TONES.neutral;
  const hue = hueOf(color);
  if (hue === null) return TONES.neutral;
  if (hue >= 340 || hue < 15) return TONES.red;
  if (hue < 50) return TONES.amber;
  if (hue < 90) return TONES.lime;
  if (hue < 150) return TONES.emerald;
  if (hue < 190) return TONES.teal;
  if (hue < 230) return TONES.sky;
  if (hue < 265) return TONES.indigo;
  if (hue < 300) return TONES.violet;
  return TONES.pink;
}
