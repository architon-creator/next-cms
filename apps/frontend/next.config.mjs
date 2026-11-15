import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
// In dev, proxy /booking to apps/booking-app (port 3001) with no setup. Override with
// BOOKING_APP_URL. In production this is unset: the platform routes /booking to the
// booking app itself (e.g. ab.com/booking), so no rewrite is needed here.
const bookingAppUrl =
  process.env.BOOKING_APP_URL ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : undefined);

const nextConfig = {
  transpilePackages: ["cms", "ui", "app-state"],
  // Local stand-in for a multi-zone deployment: serve the second app (apps/booking-app,
  // basePath "/booking") under THIS origin, like ab.com/booking in production, so both
  // apps share one localStorage. Only active when BOOKING_APP_URL is set.
  async rewrites() {
    if (!bookingAppUrl) return [];
    return {
      beforeFiles: [
        { source: "/booking", destination: `${bookingAppUrl}/booking` },
        { source: "/booking/:path*", destination: `${bookingAppUrl}/booking/:path*` },
      ],
    };
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.prismic.io" }],
  },
};

export default withNextIntl(nextConfig);
