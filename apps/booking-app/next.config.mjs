/** @type {import('next').NextConfig} */
const nextConfig = {
  // Everything this app serves lives under /booking, like ab.com/booking/... in production.
  basePath: "/booking",
  transpilePackages: ["app-state"],
};

export default nextConfig;
