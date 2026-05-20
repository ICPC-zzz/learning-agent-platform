/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@learning-agent-platform/book-engine",
    "@learning-agent-platform/db",
    "@learning-agent-platform/learning-engine",
  ],
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };

    return config;
  },
};

export default nextConfig;
