import type { NextConfig } from "next";


const nextConfig: NextConfig = {

  images: {
    unoptimized: false
  },
  basePath: '',
  assetPrefix: process.env.NODE_ENV === 'production'
      ? 'https://www.henryany.com'
      : '',
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  }
};


export default nextConfig;
