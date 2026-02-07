import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  sassOptions: {
    silenceDeprecations: ["legacy-js-api", "import"],
    includePaths: [path.join(process.cwd(), "node_modules")],
  },
  outputFileTracingIncludes: {
    "/api/**": ["./prisma/dev.db"],
    "/demos/**": ["./prisma/dev.db"],
    "/follow-up/**": ["./prisma/dev.db"],
    "/analytics": ["./prisma/dev.db"],
    "/share/**": ["./prisma/dev.db"],
    "/guided/**": ["./prisma/dev.db"],
  },
};

export default nextConfig;
