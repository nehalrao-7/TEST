import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic brand tokens, theme-flipped via CSS variables (see globals.css).
        //   ink  = page background    bone = foreground / text
        //   steel = raised surface    smoke = muted text
        // Channel-triplet vars let Tailwind opacity modifiers (e.g. bone/15) work.
        ink: "rgb(var(--ink) / <alpha-value>)",
        bone: "rgb(var(--bone) / <alpha-value>)",
        smoke: "rgb(var(--smoke) / <alpha-value>)",
        steel: "rgb(var(--steel) / <alpha-value>)",
        // Signature Game6 bronze/copper accent (sampled from the brand).
        accent: "rgb(var(--accent) / <alpha-value>)",
        // Fixed bronze for solid buttons (white text on top in both themes).
        "accent-solid": "rgb(var(--accent-solid) / <alpha-value>)",
      },
      fontFamily: {
        // Display = bold condensed all-caps; body = clean grotesque.
        display: ["var(--font-display)", "Impact", "sans-serif"],
        heading: ["var(--font-heading)", "Arial Narrow", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        brand: "0.02em",
      },
      maxWidth: {
        site: "1200px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
