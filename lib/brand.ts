/**
 * Muqabla brand configuration.
 *
 * Everything painted in the 3D scene (court, walls, scoreboard, LED ribbon,
 * sponsor boards) reads from this file. Swap these placeholder values for the
 * real brand assets and the whole arena re-skins itself.
 */

export const brand = {
  name: "MUQABLA",
  event: "MUQABLA TOURNAMENT",
  tagline: "Every name on this floor was earned.",

  /**
   * Optional logo images (transparent PNG or SVG in /public/brand).
   * While these are null, a placeholder "M" crest is drawn instead.
   */
  logo: null as string | null, // e.g. "/brand/muqabla-logo-light.png"

  colors: {
    primary: "#C8102E", // placeholder red: keys, stripes, accents
    accent: "#E9B949", // placeholder gold: trim, highlights
    ink: "#0B0B0D", // near-black: apron, walls, UI
    paper: "#F4F1EA", // off-white: lines, type
    wood: "#D9A66B", // maple floor base tone
  },

  fonts: {
    display: "Anton", // loaded via @fontsource/anton
    body: "Inter", // loaded via @fontsource/inter
  },
};

export type Sponsor = {
  name: string;
  /** Optional logo image in /public/sponsors. When null a placeholder mark is drawn. */
  logo: string | null;
  /** Placeholder mark shape, used only when there is no logo image. */
  mark: "circle" | "triangle" | "square" | "diamond" | "bars" | "ring";
  color: string;
};

/**
 * Placeholder sponsors. Replace with real partners: set `name`, drop a logo
 * file in /public/sponsors and point `logo` at it.
 */
export const sponsors: Sponsor[] = [
  { name: "SPONSOR 01", logo: null, mark: "circle", color: "#F4F1EA" },
  { name: "SPONSOR 02", logo: null, mark: "triangle", color: "#E9B949" },
  { name: "SPONSOR 03", logo: null, mark: "square", color: "#F4F1EA" },
  { name: "SPONSOR 04", logo: null, mark: "diamond", color: "#F4F1EA" },
  { name: "SPONSOR 05", logo: null, mark: "bars", color: "#E9B949" },
  { name: "SPONSOR 06", logo: null, mark: "ring", color: "#F4F1EA" },
];
