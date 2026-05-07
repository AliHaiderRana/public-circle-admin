const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Keep Chromium and Puppeteer out of server bundles so runtime paths resolve
  // correctly in Vercel serverless functions.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@sparticuz/chromium/bin/**"],
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
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
