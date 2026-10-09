import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev/test server run next to the main one without sharing
  // (and fighting over) the .next folder, e.g. NEXT_DIST_DIR=.next-test.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["cms", "ui"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.prismic.io" }],
  },
};

export default withNextIntl(nextConfig);
