import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["cms", "ui"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.prismic.io" }],
  },
};

export default withNextIntl(nextConfig);
