import type { NextConfig } from "next";
import withPWA from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

const pwa = withPWA({
  dest: "public",
  disable: isDev,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default pwa(nextConfig);
