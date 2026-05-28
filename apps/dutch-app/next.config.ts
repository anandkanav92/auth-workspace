import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@myorg/auth-google"],
  output: "standalone",
};

export default nextConfig;
