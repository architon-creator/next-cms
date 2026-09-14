/** @type {import('next').NextConfig} */
const nextConfig = {
  // prismic-migration ships raw TypeScript (bundler-style, extensionless
  // imports) from its workspace package.json `exports` map, same as
  // apps/frontend already transpiles "cms"/"ui" — needs the same here so
  // Next's build actually compiles it instead of trying to load .ts
  // straight out of node_modules.
  transpilePackages: ["prismic-migration"],
};

export default nextConfig;
