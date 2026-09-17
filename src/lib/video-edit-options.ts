// Client-safe video-edit types, no server-only imports -- safe to import from a "use client" component.
// Mirrors src/lib/image-filters.ts.
export type VideoAdjust = { brightness: number; contrast: number; saturation: number };
export const DEFAULT_VIDEO_ADJUST: VideoAdjust = { brightness: 1, contrast: 1, saturation: 1 };
export const videoAdjustCss = (a: VideoAdjust) => `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturation})`;

export type VideoEditRecipe = {
  trim?: { startMs: number; endMs: number };
  crop?: { x: number; y: number; width: number; height: number };
  adjust?: VideoAdjust;
};
export type AiVideoEditOp = "auto_caption" | "voice_swap";
export const VOICE_OPTIONS: { id: string; name: string }[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (calm, narrative)" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (strong, confident)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (soft, friendly)" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (warm, well-rounded)" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli (energetic, youthful)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (deep, casual)" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold (crisp, authoritative)" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (deep, narration)" },
];
