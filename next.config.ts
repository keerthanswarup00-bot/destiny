import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    middlewareClientMaxBodySize: "100mb",
  },
  images: {
    qualities: [86],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "https://destiny-site-omega.vercel.app/" },
        { source: "/work", destination: "https://destiny-site-omega.vercel.app/work" },
        { source: "/work/:path*", destination: "https://destiny-site-omega.vercel.app/work/:path*" },
        { source: "/about", destination: "https://destiny-site-omega.vercel.app/about" },
        { source: "/about/:path*", destination: "https://destiny-site-omega.vercel.app/about/:path*" },
        { source: "/contact", destination: "https://destiny-site-omega.vercel.app/contact" },
        { source: "/contact/:path*", destination: "https://destiny-site-omega.vercel.app/contact/:path*" },
        { source: "/media/:path*", destination: "https://destiny-site-omega.vercel.app/media/:path*" },
        { source: "/robots.txt", destination: "https://destiny-site-omega.vercel.app/robots.txt" },
        { source: "/sitemap.xml", destination: "https://destiny-site-omega.vercel.app/sitemap.xml" },
      ],
    };
  },
};

export default nextConfig;
