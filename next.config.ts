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
      // Public-site page routes. These stay in `beforeFiles` on purpose: this app also has its
      // own on-disk `/` (app/(public)/page.tsx) and `/contact` (app/(public)/contact/page.tsx),
      // which must stay shadowed by the public site's build. `beforeFiles` beats the filesystem,
      // so moving these to `afterFiles` would silently un-shadow them and swap the public
      // website for this app's older pages.
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
      // Public-site build assets. The public build is a separate Next.js app with its own
      // chunk hashes, and it no longer sets `assetPrefix`, so it emits relative `/_next/...`
      // URLs. Those resolve against the apex — this project — which would 404 without this rule.
      //
      // `afterFiles`, not `beforeFiles`: this project also serves its own build output from
      // `/_next/static/**`, and `beforeFiles` is evaluated *before* the filesystem, so it would
      // shadow this project's own chunks/CSS/media and break /login, /gallery and /admin.
      // `afterFiles` runs only when nothing matched on disk, so local assets always win and only
      // paths that exist solely in the public build fall through to the proxy.
      //
      // Deliberately scoped to `/_next/static/` rather than the public build's `immutable/`
      // subdirectory: that subdirectory name is a Turbopack implementation detail and differs
      // between builds (Next 16 emits `immutable/`, some builds emit `chunks/`). Keying on the
      // stable `/_next/static/` prefix covers JS, CSS, fonts and images for any of them.
      //
      // No collision risk: both builds content-hash asset filenames, so a public asset name can
      // never also exist in this project's `.next/static/`. When it does collide the two files are
      // byte-identical, so serving either is correct.
      afterFiles: [
        { source: "/_next/static/:path*", destination: "https://destiny-site-omega.vercel.app/_next/static/:path*" },
      ],
    };
  },
};

export default nextConfig;
