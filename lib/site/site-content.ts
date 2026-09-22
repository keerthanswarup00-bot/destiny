import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CLIENT_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { galleryOverviews } from "@/lib/gallery-data";
import { siteDb } from "@/lib/site/site-db";
import { getWebsiteGalleryHighlight, getWebsiteGalleryImages, normalizeWebsiteGalleryCategory, websiteGalleryExists, type WebsiteGalleryCategory } from "@/lib/site/website-gallery";
import { photoStore } from "@/lib/storage-provider";

/* ---------------------------------------------------------------------------
   Public website content model + reads. All reads are server-only and fall
   back to curated defaults when the database is unreachable or unseeded.
--------------------------------------------------------------------------- */

export type HomeHero = {
  eyebrow: string;
  heading: string;
  description: string;
  primary_label: string;
  primary_url: string;
  secondary_label: string;
  secondary_url: string;
  image_path: string | null;
  image_mime: string | null;
  image_bytes: number | null;
};

export type HomeCategory = { label: string };

export type HomeWhatWeDocument = {
  enabled: boolean;
  label: string;
  items: HomeCategory[];
};

export type HomeStories = {
  enabled: boolean;
  title: string;
  description: string;
};

export type HomePrinciple = { label: string; description: string };

export type HomeApproach = {
  enabled: boolean;
  label: string;
  heading: string;
  body: string;
  image_path: string | null;
  image_mime: string | null;
  image_bytes: number | null;
  principles: HomePrinciple[];
};

export type HomeCta = {
  enabled: boolean;
  label: string;
  heading: string;
  description: string;
  button_text: string;
  button_url: string;
};

export type SiteHome = {
  hero: HomeHero;
  whatWeDocument: HomeWhatWeDocument;
  stories: HomeStories;
  approach: HomeApproach;
  cta: HomeCta;
};

export type SiteContact = {
  studio_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  location: string;
  address: string;
  hours: string;
  heading: string;
  description: string;
  cta_text: string;
};

export type SiteBranding = {
  brand_name: string;
  short_name: string;
  tagline: string;
  logo_path: string | null;
  light_logo_path: string | null;
  dark_logo_path: string | null;
  favicon_path: string | null;
  social_image_path: string | null;
};

export type SiteBrandingResolved = SiteBranding & {
  logoUrl: string | null;
  lightLogoUrl: string | null;
  darkLogoUrl: string | null;
  faviconUrl: string | null;
  socialImageUrl: string | null;
};

export type SiteTheme = { preset: string; accent: string | null };

export type ThemeTokens = {
  bg: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  accentFg: string;
};

/* -------------------------------- defaults -------------------------------- */

export const DEFAULT_HERO: HomeHero = {
  eyebrow: "DESTINY EVENTS + PHOTOGRAPHY",
  heading: "Stories. Moments.\nCaptured with intention.",
  description:
    "Timeless imagery for weddings, events, and celebrations — crafted with quiet attention and lasting feeling.",
  primary_label: "View gallery",
  primary_url: "/gallery",
  secondary_label: "Plan your event",
  secondary_url: "/contact",
  image_path: null,
  image_mime: null,
  image_bytes: null,
};

export const DEFAULT_WHAT_WE_DOCUMENT: HomeWhatWeDocument = {
  enabled: true,
  label: "WHAT WE DOCUMENT",
  items: [{ label: "Weddings" }, { label: "Events" }, { label: "Portraits" }, { label: "Celebrations" }],
};

export const DEFAULT_STORIES: HomeStories = {
  enabled: true,
  title: "SELECTED STORIES",
  description: "A few moments from recent celebrations, chosen for the feeling they keep.",
};

export const DEFAULT_APPROACH: HomeApproach = {
  enabled: true,
  label: "OUR APPROACH",
  heading: "We don't simply document the moment.\nWe look for the moments worth remembering.",
  body: "",
  image_path: null,
  image_mime: null,
  image_bytes: null,
  principles: [
    { label: "Observe", description: "We arrive early, stay quiet, and follow the light before the day begins." },
    { label: "Frame", description: "Every composition is intentional — clean lines, honest emotion, nothing staged." },
    { label: "Preserve", description: "We deliver photographs made to be returned to for years, not days." },
  ],
};

export const DEFAULT_CTA: HomeCta = {
  enabled: true,
  label: "START A CONVERSATION",
  heading: "Let's create\nsomething memorable.",
  description: "Tell us about your event — we'll be in touch within two business days.",
  button_text: "Get in touch",
  button_url: "/contact",
};

export const DEFAULT_SITE_HOME: SiteHome = {
  hero: DEFAULT_HERO,
  whatWeDocument: DEFAULT_WHAT_WE_DOCUMENT,
  stories: DEFAULT_STORIES,
  approach: DEFAULT_APPROACH,
  cta: DEFAULT_CTA,
};

export const DEFAULT_CONTACT: SiteContact = {
  studio_name: "Destiny Events and Photography",
  email: "destinyeventsandphotography@gmail.com",
  phone: "9108727795",
  whatsapp: "9108727795",
  instagram: "",
  location: "India · Available worldwide",
  address: "",
  hours: "",
  heading: "Let's work together.",
  description:
    "Tell us a little about what you're planning. We'll get back to you on WhatsApp.",
  cta_text: "Send enquiry",
};

export const DEFAULT_BRANDING: SiteBranding = {
  brand_name: "Destiny Events and Photography",
  short_name: "DESTINY",
  tagline: "EVENTS + PHOTOGRAPHY",
  logo_path: null,
  light_logo_path: null,
  dark_logo_path: null,
  favicon_path: null,
  social_image_path: null,
};

export const DEFAULT_THEME: SiteTheme = { preset: "destiny-yellow", accent: null };

/* -------------------------------- theme ----------------------------------- */

export const THEME_PRESETS: Record<string, { label: string; tokens: ThemeTokens }> = {
  "destiny-yellow": {
    label: "Destiny Yellow",
    tokens: { bg: "#FFFFFF", fg: "#101010", accent: "#F4C400", accentFg: "#101010", muted: "#6E6E6E", line: "#E7E5E0" },
  },
  mono: {
    label: "Mono",
    tokens: { bg: "#FFFFFF", fg: "#000000", accent: "#000000", accentFg: "#FFFFFF", muted: "#5C5C5C", line: "#E5E5E5" },
  },
  "warm-ivory": {
    label: "Warm Ivory",
    tokens: { bg: "#F7F6F2", fg: "#111111", accent: "#C9A227", accentFg: "#111111", muted: "#6E6E63", line: "#E6E2D8" },
  },
  "soft-stone": {
    label: "Soft Stone",
    tokens: { bg: "#F1F0EC", fg: "#171717", accent: "#D4AF37", accentFg: "#171717", muted: "#6C6A63", line: "#DDD9D0" },
  },
  black: {
    label: "Black",
    tokens: { bg: "#0A0A0A", fg: "#F2F2F2", accent: "#F4C400", accentFg: "#101010", muted: "#9A9A9A", line: "#262626" },
  },
};

export const THEME_PRESET_KEYS = Object.keys(THEME_PRESETS);

export function themeTokens(theme: SiteTheme): ThemeTokens {
  const preset = THEME_PRESETS[theme.preset] ?? THEME_PRESETS["destiny-yellow"];
  const base = { ...preset.tokens };
  if (theme.accent) {
    base.accent = theme.accent;
    base.accentFg = readableOnColor(theme.accent);
  }
  return base;
}

function readableOnColor(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  // Perceived luminance (WCAG relative luminance approximation)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.45 ? "#101010" : "#FFFFFF";
}

export function themeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    "--site-bg": tokens.bg,
    "--site-fg": tokens.fg,
    "--site-muted": tokens.muted,
    "--site-line": tokens.line,
    "--site-accent": tokens.accent,
    "--site-accent-foreground": tokens.accentFg,
  };
}

/* ---------------------------- public read cache ---------------------------- */

/**
 * Stable tags used to invalidate public website content after admin edits.
 * Mirror these exact strings in the admin CMS Server Actions that call
 * revalidateTag() (app/admin/website/actions.ts, app/admin/set-actions.ts).
 */
export const SITE_CACHE_TAGS = {
  home: "site-home",
  stories: "site-stories",
  portfolio: "site-portfolio",
  contact: "site-contact",
  branding: "site-branding",
  theme: "site-theme",
  websiteGallery: "site-website-gallery",
} as const;

/**
 * CMS results embed signed object URLs valid for CLIENT_SIGNED_URL_SECONDS
 * (60 * 15 = 15 minutes). Keep the cache TTL well inside that window so a
 * served page never holds an expired URL. Admin edits invalidate the tags
 * immediately, so this TTL is only a safety net.
 */
const SITE_CACHE_SECONDS = 300;

/* --------------------------------- reads ---------------------------------- */

function asHome(value: unknown): SiteHome {
  if (!value || typeof value !== "object") return DEFAULT_SITE_HOME;
  const row = value as { hero?: unknown; what_we_document?: unknown; stories?: unknown; approach?: unknown; cta?: unknown };
  return {
    hero: { ...DEFAULT_HERO, ...(row.hero && typeof row.hero === "object" ? row.hero : {}) } as HomeHero,
    whatWeDocument: { ...DEFAULT_WHAT_WE_DOCUMENT, ...(row.what_we_document && typeof row.what_we_document === "object" ? row.what_we_document : {}) } as HomeWhatWeDocument,
    stories: { ...DEFAULT_STORIES, ...(row.stories && typeof row.stories === "object" ? row.stories : {}) } as HomeStories,
    approach: { ...DEFAULT_APPROACH, ...(row.approach && typeof row.approach === "object" ? row.approach : {}) } as HomeApproach,
    cta: { ...DEFAULT_CTA, ...(row.cta && typeof row.cta === "object" ? row.cta : {}) } as HomeCta,
  };
}

async function loadSiteHome(): Promise<SiteHome> {
  try {
    const db = siteDb();
    const { data } = await db.from("site_home").select("hero,what_we_document,stories,approach,cta").eq("id", "home").maybeSingle();
    return asHome(data);
  } catch {
    return DEFAULT_SITE_HOME;
  }
}

/*
 * Public CMS reads are wrapped with `cache` (request-scoped memoization, so
 * duplicate calls within one render — e.g. generateMetadata + layout — run
 * once) and `unstable_cache` (persists the result across requests until the
 * matching tag is revalidated or the TTL elapses). See SITE_CACHE_TAGS.
 */
export const getSiteHome = cache(unstable_cache(loadSiteHome, ["site-home"], { tags: [SITE_CACHE_TAGS.home], revalidate: SITE_CACHE_SECONDS }));

async function signedAssetMap(paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!unique.length) return new Map();
  try {
    return await photoStore().signedGetUrls(unique, CLIENT_SIGNED_URL_SECONDS);
  } catch {
    return new Map();
  }
}

export type SiteStory = {
  id: string;
  gallery_id: string;
  slug: string;
  title: string;
  category: string | null;
  location: string | null;
  event_date: string | null;
  sort_order: number;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
};

async function loadSiteStories(): Promise<SiteStory[]> {
  try {
    const db = siteDb();
    const [{ data: storyRows }, { data: galleryRows }] = await Promise.all([
      db.from("site_stories").select("id,gallery_id,title,category,location,event_date,sort_order,published").eq("published", true).order("sort_order").order("id"),
      db.from("galleries").select("id,slug,title,status").eq("status", "published"),
    ]);
    const byId = new Map((galleryRows ?? []).map(gallery => [gallery.id, gallery]));
    const stories: SiteStory[] = (storyRows ?? []).flatMap(row => {
      const gallery = byId.get(row.gallery_id);
      if (!gallery) return [];
      return [{
        id: row.id,
        gallery_id: gallery.id,
        slug: gallery.slug,
        title: row.title?.trim() || gallery.title,
        category: row.category,
        location: row.location,
        event_date: row.event_date,
        sort_order: row.sort_order,
        coverUrl: null,
        coverWidth: null,
        coverHeight: null,
      }];
    });
    const covers = await galleryOverviews(stories.map(story => story.gallery_id));
    for (const story of stories) {
      const overview = covers.get(story.gallery_id);
      story.coverUrl = overview?.coverUrl ?? null;
      story.coverWidth = overview?.coverWidth ?? null;
      story.coverHeight = overview?.coverHeight ?? null;
    }
    return stories;
  } catch {
    return [];
  }
}

export const getSiteStories = cache(unstable_cache(loadSiteStories, ["site-stories"], { tags: [SITE_CACHE_TAGS.stories], revalidate: SITE_CACHE_SECONDS }));

export type PortfolioGallery = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  event_date: string | null;
  photoCount: number;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
};

async function loadPortfolioGalleries(): Promise<PortfolioGallery[]> {
  try {
    const db = siteDb();
    const { data: galleries } = await db
      .from("galleries")
      .select("id,slug,title,description,category,location,event_date,portfolio_sort")
      .eq("show_in_portfolio", true)
      .eq("status", "published")
      .order("portfolio_sort")
      .order("id");
    const rows = galleries ?? [];
    const covers = await galleryOverviews(rows.map(gallery => gallery.id));
    return rows.map(gallery => {
      const overview = covers.get(gallery.id);
      return {
        id: gallery.id,
        slug: gallery.slug,
        title: gallery.title,
        description: gallery.description,
        category: gallery.category,
        location: gallery.location,
        event_date: gallery.event_date,
        photoCount: overview?.photoCount ?? 0,
        coverUrl: overview?.coverUrl ?? null,
        coverWidth: overview?.coverWidth ?? null,
        coverHeight: overview?.coverHeight ?? null,
      };
    });
  } catch {
    return [];
  }
}

export const getPortfolioGalleries = cache(
  unstable_cache(loadPortfolioGalleries, ["site-portfolio"], {
    tags: [SITE_CACHE_TAGS.portfolio, SITE_CACHE_TAGS.stories],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

export type SiteWebsiteImage = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  category: WebsiteGalleryCategory | null;
};

async function loadSiteWebsiteGallery(): Promise<SiteWebsiteImage[]> {
  return (await getWebsiteGalleryImages()).map(image => ({
    id: image.id,
    url: image.url,
    width: image.width,
    height: image.height,
    category: image.category,
  }));
}

export const getSiteWebsiteGallery = cache(
  unstable_cache(loadSiteWebsiteGallery, ["site-website-gallery"], {
    tags: [SITE_CACHE_TAGS.websiteGallery],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

async function loadSiteWebsiteGalleryByCategory(category?: string): Promise<SiteWebsiteImage[]> {
  const normalized = normalizeWebsiteGalleryCategory(category);
  return (await getWebsiteGalleryImages(normalized)).map(image => ({
    id: image.id,
    url: image.url,
    width: image.width,
    height: image.height,
    category: image.category,
  }));
}

export const getSiteWebsiteGalleryByCategory = cache(
  unstable_cache(loadSiteWebsiteGalleryByCategory, ["site-website-gallery-by-category"], {
    tags: [SITE_CACHE_TAGS.websiteGallery],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

async function loadHasSiteWebsiteGallery(): Promise<boolean> {
  return websiteGalleryExists(siteDb());
}

export const hasSiteWebsiteGallery = cache(
  unstable_cache(loadHasSiteWebsiteGallery, ["has-site-website-gallery"], {
    tags: [SITE_CACHE_TAGS.websiteGallery],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

async function loadSiteWebsiteGalleryHighlight() {
  const highlight = await getWebsiteGalleryHighlight();
  if (!highlight) return null;
  return {
    url: highlight.photo.url,
    width: highlight.photo.width,
    height: highlight.photo.height,
    crop: highlight.crop,
  };
}

export const getSiteWebsiteGalleryHighlight = cache(
  unstable_cache(loadSiteWebsiteGalleryHighlight, ["site-website-gallery-highlight"], {
    tags: [SITE_CACHE_TAGS.websiteGallery],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

function asContact(value: unknown): SiteContact {
  if (!value || typeof value !== "object") return DEFAULT_CONTACT;
  return { ...DEFAULT_CONTACT, ...(value as Partial<SiteContact>) };
}

export async function loadSiteContact(): Promise<SiteContact> {
  try {
    const db = siteDb();
    const { data } = await db.from("site_contact").select("*").eq("id", "contact").maybeSingle();
    return asContact(data);
  } catch {
    return DEFAULT_CONTACT;
  }
}

export const getSiteContact = cache(
  unstable_cache(loadSiteContact, ["site-contact"], {
    tags: [SITE_CACHE_TAGS.contact],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

function asBranding(value: unknown): SiteBranding {
  if (!value || typeof value !== "object") return DEFAULT_BRANDING;
  return { ...DEFAULT_BRANDING, ...(value as Partial<SiteBranding>) };
}

async function loadSiteBranding(): Promise<SiteBrandingResolved> {
  try {
    const db = siteDb();
    const { data } = await db.from("site_branding").select("*").eq("id", "branding").maybeSingle();
    const branding = asBranding(data);
    const urls = await signedAssetMap([branding.logo_path, branding.light_logo_path, branding.dark_logo_path, branding.favicon_path, branding.social_image_path]);
    return { ...branding, logoUrl: branding.logo_path ? urls.get(branding.logo_path) ?? null : null, lightLogoUrl: branding.light_logo_path ? urls.get(branding.light_logo_path) ?? null : null, darkLogoUrl: branding.dark_logo_path ? urls.get(branding.dark_logo_path) ?? null : null, faviconUrl: branding.favicon_path ? urls.get(branding.favicon_path) ?? null : null, socialImageUrl: branding.social_image_path ? urls.get(branding.social_image_path) ?? null : null };
  } catch {
    return { ...DEFAULT_BRANDING, logoUrl: null, lightLogoUrl: null, darkLogoUrl: null, faviconUrl: null, socialImageUrl: null };
  }
}

export const getSiteBranding = cache(
  unstable_cache(loadSiteBranding, ["site-branding"], {
    tags: [SITE_CACHE_TAGS.branding],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

async function loadSiteThemeSetting(): Promise<SiteTheme> {
  try {
    const db = siteDb();
    const { data } = await db.from("site_theme").select("preset,accent").eq("id", "theme").maybeSingle();
    if (!data) return DEFAULT_THEME;
    return {
      preset: THEME_PRESET_KEYS.includes(data.preset) ? data.preset : "destiny-yellow",
      accent: data.accent,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export const getSiteThemeSetting = cache(
  unstable_cache(loadSiteThemeSetting, ["site-theme"], {
    tags: [SITE_CACHE_TAGS.theme],
    revalidate: SITE_CACHE_SECONDS,
  }),
);

export async function getSiteThemeTokens(): Promise<ThemeTokens> {
  return themeTokens(await getSiteThemeSetting());
}

export async function getSiteThemeCssVars(): Promise<Record<string, string>> {
  return themeCssVars(await getSiteThemeTokens());
}

/** Resolve signed URLs for CMS-provided photography (home hero, approach image). */
export async function resolveSiteAssetPaths(paths: (string | null)[]): Promise<Record<string, string>> {
  const map = await signedAssetMap(paths);
  return Object.fromEntries(map.entries());
}