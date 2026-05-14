import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@agent-office/shared"],
  output: "standalone",
  // better-sqlite3 is a native addon — exclude from webpack so Node.js
  // resolves it at runtime (finds the .node file correctly via bindings).
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/api/**": ["../../node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/**"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const ext = config.externals ?? [];
      config.externals = [...(Array.isArray(ext) ? ext : [ext]), "better-sqlite3"];
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
