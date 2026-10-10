import type { NextConfig } from "next";

// Model weights and the ONNX runtime are large and change only on redeploy; let browsers keep them for a day.
const longCache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      { source: "/ort/:path*", headers: longCache },
      { source: "/models/:slug/:file(.+\\.(?:onnx|bin|json))", headers: longCache },
    ];
  },
};

export default nextConfig;
