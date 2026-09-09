/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["cms"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.prismic.io" }],
  },
};

export default nextConfig;
