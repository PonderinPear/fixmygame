import type { MetadataRoute } from "next";

const baseUrl = "https://fixmygame-site.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-06");

  return [
    "",
    "/guides",

    // Start Here
    "/guides/how-to-read-a-crash-log",
    "/guides/fresh-log-vs-old-log",

    // Crash Fix Library
    "/guides/minecraft-jei-classnotfoundexception-fix",
    "/guides/minecraft-unsupportedclassversionerror-java-17-fix",
    "/guides/minecraft-fabric-api-missing-dependency-fix",
    "/guides/stardew-smapi-empty-folder-skipped-mod-fix",
    "/guides/lethal-company-bepinex-logoutput-fix",

    // FixMyGame Help
    "/guides/missing-dependencies",
    "/guides/mod-conflicts",
    "/guides/safe-repair-preview",
    "/guides/verify-or-reinstall-game-files",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
  }));
}