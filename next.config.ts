const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Keep Chromium and Puppeteer out of server bundles so runtime paths resolve
  // correctly in Vercel serverless functions.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    // App Router API routes
    "/api/:path*": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/puppeteer-core/**",
    ],
    // Extra safety for direct route matching
    "/api/templates/sample": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/puppeteer-core/**",
    ],
    "/api/templates/sample/route": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/puppeteer-core/**",
    ],
    // Global fallback
    "/*": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/puppeteer-core/**",
    ],
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@sparticuz/chromium", "puppeteer-core");
    }
    return config;
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
