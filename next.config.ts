import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '',
  assetPrefix: process.env.NODE_ENV === 'production' 
  ? 'https://www.henryany.com'
  : '',
  trailingSlash: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  }
};

export default nextConfig;