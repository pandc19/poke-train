import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets another device on the home network (an iPad) load the dev server's scripts.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
