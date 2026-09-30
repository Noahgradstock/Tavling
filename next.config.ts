import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The trust API reads its knowledge from these files at runtime.
  outputFileTracingIncludes: {
    "/api/trust/*": ["./data/salary/**/*"],
  },
};

export default nextConfig;
