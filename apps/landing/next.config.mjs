/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/docs',        destination: '/#how', permanent: true },
      { source: '/docs/:slug*', destination: '/#how', permanent: true },
    ];
  },
};

export default nextConfig;
