/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile React-PDF for Next.js compatibility
  transpilePackages: ["@react-pdf/renderer", "react-pdf"],
  webpack: (config) => {
    // Fix for react-pdf ESM imports
    config.resolve.alias.canvas = false;
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.logo.dev",
      },
    ],
  },
};

export default nextConfig;
