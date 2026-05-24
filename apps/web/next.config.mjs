import createNextIntlPlugin from "next-intl/plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@agent-office/shared"],
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "better-sqlite3",
        "bindings",
      ];
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
