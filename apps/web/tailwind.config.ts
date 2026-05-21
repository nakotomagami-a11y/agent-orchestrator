import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", "[data-theme='dark']"],
  theme: {
    extend: {
      screens: {
        mobile: "600px",
      },
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
        ao: {
          bg: {
            0: "var(--ao-bg-0)",
            1: "var(--ao-bg-1)",
            2: "var(--ao-bg-2)",
            3: "var(--ao-bg-3)",
            4: "var(--ao-bg-4)",
          },
          line: {
            1: "var(--ao-line-1)",
            2: "var(--ao-line-2)",
          },
          fg: {
            0: "var(--ao-fg-0)",
            1: "var(--ao-fg-1)",
            2: "var(--ao-fg-2)",
            3: "var(--ao-fg-3)",
          },
          accent: {
            DEFAULT: "var(--ao-accent)",
            soft: "var(--ao-accent-soft)",
            line: "var(--ao-accent-line)",
          },
          ok: {
            DEFAULT: "var(--ao-ok)",
            soft: "var(--ao-ok-soft)",
          },
          warn: {
            DEFAULT: "var(--ao-warn)",
            soft: "var(--ao-warn-soft)",
          },
          bad: {
            DEFAULT: "var(--ao-bad)",
            soft: "var(--ao-bad-soft)",
          },
        },
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        "ao-sm": "var(--ao-radius-sm)",
        "ao-md": "var(--ao-radius-md)",
        "ao-lg": "var(--ao-radius-lg)",
        "ao-xl": "var(--ao-radius-xl)",
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
