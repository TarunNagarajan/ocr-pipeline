import type { NextConfig } from "next";
import { resolve } from "node:path";

const isCapacitor = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  
  output: isCapacitor ? "export" : "standalone",
  images: {
    unoptimized: isCapacitor ? true : undefined,
  },
  turbopack: isCapacitor ? undefined : {
    root: resolve(__dirname, "../..")
  },
};

export default nextConfig;
