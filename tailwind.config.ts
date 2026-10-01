import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Theme accent with opacity support (e.g. bg-accent/15); set by ThemeManager.
        accent: "rgba(var(--theme-accent-rgb), <alpha-value>)",
        // Ahead / behind / neutral, the same in every theme.
        ahead: "#40ff40",
        behind: "#ff4040",
        neutral: "#aaaaaa",
      },
      fontFamily: {
        sans: ["'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Consolas", "'Courier New'", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
