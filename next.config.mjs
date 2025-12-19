/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile React-PDF for Next.js compatibility
  transpilePackages: ["@react-pdf/renderer"],
  webpack: (config) => {
    // Fix for react-pdf ESM imports
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
