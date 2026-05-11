import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", "[data-theme='dark']"],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      colors: {
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
          3: "var(--bg-3)",
          elev: "var(--bg-elev)",
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
          strong: "var(--line-strong)",
        },
        txt: {
          DEFAULT: "var(--txt)",
          2: "var(--txt-2)",
          3: "var(--txt-3)",
          4: "var(--txt-4)",
        },
        acc: {
          DEFAULT: "var(--acc)",
          hover: "var(--acc-hover)",
          faint: "var(--acc-faint)",
          tint: "var(--acc-tint)",
          ink: "var(--acc-ink)",
        },
        status: {
          working: "var(--working)",
          done: "var(--done)",
          idle: "var(--idle)",
          queued: "var(--queued)",
          error: "var(--error)",
          thinking: "var(--thinking)",
        },
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
        window: "var(--shadow-window)",
      },
    },
  },
  plugins: [],
};

export default config;
