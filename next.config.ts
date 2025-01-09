import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS || false;
const repo = process.env.GITHUB_REPOSITORY?.replace(/.*?\//, '');

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Correctly handle asset prefixes for both development and production
  basePath: isGithubActions ? `/${repo}` : '',
  assetPrefix: isGithubActions ? `/${repo}/` : '',
};

export default nextConfig;