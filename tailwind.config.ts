import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // True black & white brand system with a few neutral steps.
        ink: "#0a0a0a",
        bone: "#f5f5f3",
        smoke: "#9a9a9a",
        steel: "#1a1a1a",
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
