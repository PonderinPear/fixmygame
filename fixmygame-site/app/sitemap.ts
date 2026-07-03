import type { MetadataRoute } from "next";

const baseUrl = "https://fixmygame-site.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/guides`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/guides/how-to-read-a-crash-log`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/guides/fresh-log-vs-old-log`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/guides/missing-dependencies`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/guides/mod-conflicts`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/guides/safe-repair-preview`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/guides/verify-or-reinstall-game-files`,
      lastModified: new Date(),
    },
  ];
}