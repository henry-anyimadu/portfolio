import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Required for GitHub Pages
  basePath: "",
  assetPrefix: "https://henryany.com",
};

export default nextConfig;
