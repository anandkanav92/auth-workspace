import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@myorg/auth-google'],
};

export default nextConfig;
