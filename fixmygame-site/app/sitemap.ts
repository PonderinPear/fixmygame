import type { MetadataRoute } from "next";

const baseUrl = "https://fixmygame-site.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-06");

  return [
    "",
    "/guides",
    "/guides/how-to-read-a-crash-log",
    "/guides/fresh-log-vs-old-log",
    "/guides/missing-dependencies",
    "/guides/mod-conflicts",
    "/guides/safe-repair-preview",
    "/guides/verify-or-reinstall-game-files",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
  }));
}