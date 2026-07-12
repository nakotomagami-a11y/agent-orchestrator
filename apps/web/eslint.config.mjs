import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

/**
 * Strict ESLint config for production.
 *
 * We used to spread `...next` here, but `eslint-config-next`'s
 * `@rushstack/eslint-patch` isn't compatible with ESLint 9's flat
 * config. Instead we own the rule set directly — same discipline, no
 * dependency on the rushstack shim.
 *
 * Rules enforced:
 *   - `@typescript-eslint/no-explicit-any` — no `any` types.
 *   - `@typescript-eslint/no-unused-vars` — no dead code (allows
 *     `_`-prefixed intentional-unused).
 *   - `no-console: ["error", { allow: ["warn", "error"] }]` — no
 *     dev-cruft `console.log/debug/info`.
 *   - CLAUDE.md architecture rule (warn): flag CSS Grid usage in JSX
 *     className strings and template literals. Convert to Flexbox.
 */
export default [
  {
    ignores: ["**/.next/**", "**/node_modules/**", "**/dist/**", "**/build/**", "**/starter-data/**"],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      // Register Next + react-hooks rules so codebase `// eslint-disable`
      // directives targeting them stay valid. We keep the checks ON —
      // hooks/deps + img/element are legit prod concerns.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "off",

      // ── TypeScript strictness ──────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      // ── Runtime hygiene ────────────────────────────────────────
      "no-console": ["error", { allow: ["warn", "error"] }],

      // ── Architecture rules (CLAUDE.md — Flexbox only) ──────────
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\b(grid-cols-|grid-rows-|grid-template|grid-flow|grid-area)\\b/]",
          message:
            "CSS Grid is forbidden by CLAUDE.md — use Flexbox (flex + flex-wrap + basis-* / w-* / flex-1).",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(grid-cols-|grid-rows-|grid-template|grid-flow|grid-area)\\b/]",
          message:
            "CSS Grid is forbidden by CLAUDE.md — use Flexbox (flex + flex-wrap + basis-* / w-* / flex-1).",
        },
      ],
    },
  },
  {
    // Instrumentation runs at server boot; a startup log line is
    // acceptable operator signal.
    files: ["src/instrumentation-node.ts"],
    rules: { "no-console": "off" },
  },
];
