// Filter preset definitions shared between the client (CSS `filter` live preview) and the server
// (equivalent sharp recipe in src/lib/render/image-edit.ts) -- defined once here so the two never drift.
// No server-only imports (no sharp) -- safe to import from a "use client" component.
export type FilterPresetId = "original" | "vivid" | "bw" | "vintage" | "warm" | "cool" | "fade" | "high_contrast";
export type FilterPreset = {
  id: FilterPresetId; label: string; css: string;
  modulate?: { brightness?: number; saturation?: number; hue?: number };
  linear?: [number, number]; tint?: string; greyscale?: boolean;
};
export const FILTER_PRESETS: FilterPreset[] = [
  { id: "original", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.5) contrast(1.1)", modulate: { saturation: 1.5 }, linear: [1.1, -10] },
  { id: "bw", label: "B&W", css: "grayscale(1)", greyscale: true },
  { id: "vintage", label: "Vintage", css: "sepia(0.35) contrast(0.92) brightness(1.05) saturate(0.85)", modulate: { brightness: 1.05, saturation: 0.85 }, tint: "#704214", linear: [0.92, 5] },
  { id: "warm", label: "Warm", css: "sepia(0.2) saturate(1.2) hue-rotate(-10deg)", modulate: { saturation: 1.2, hue: -10 } },
  { id: "cool", label: "Cool", css: "saturate(1.1) hue-rotate(15deg) brightness(1.02)", modulate: { saturation: 1.1, hue: 15, brightness: 1.02 } },
  { id: "fade", label: "Fade", css: "contrast(0.85) brightness(1.1) saturate(0.7)", modulate: { brightness: 1.1, saturation: 0.7 }, linear: [0.85, 15] },
  { id: "high_contrast", label: "High contrast", css: "contrast(1.4) saturate(1.1)", modulate: { saturation: 1.1 }, linear: [1.4, -20] },
];
export type ImageAdjust = { brightness: number; contrast: number; saturation: number };
export const DEFAULT_ADJUST: ImageAdjust = { brightness: 1, contrast: 1, saturation: 1 };
export const adjustCss = (a: ImageAdjust) => `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturation})`;

export type TextOverlayBox = { text: string; xPct: number; yPct: number; fontSizePx: number; color: string; bold?: boolean; fontFamily?: string };
export type ImageEditRecipe = {
  crop?: { x: number; y: number; width: number; height: number };
  rotate?: number;
  adjust?: ImageAdjust;
  filterPreset?: FilterPresetId;
  textOverlays?: TextOverlayBox[];
  resize?: { width: number; height: number };
};
export type AiEditOp = "bg_remove" | "inpaint" | "upscale";
