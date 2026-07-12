import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FixMyGame Guides | Crash Log & Modded Game Help",
  description:
    "Beginner-friendly guides for crash logs, missing dependencies, mod conflicts, SMAPI logs, BepInEx logs, Minecraft errors, and safe repair previews.",
  alternates: {
    canonical: "/guides",
  },
  openGraph: {
    title: "FixMyGame Guides",
    description:
      "Crash log help, mod troubleshooting guides, missing dependency fixes, and safer repair steps for modded PC games.",
    url: "/guides",
    siteName: "FixMyGame",
    type: "website",
  },
};

const guideSections = [
  {
    title: "Start Here",
    description:
      "Basic FixMyGame and crash-log help before you start changing files.",
    guides: [
      {
        title: "How to Read a Crash Log",
        description:
          "Learn what parts of a crash log actually matter and what can usually be ignored.",
        tag: "Beginner",
        href: "/guides/how-to-read-a-crash-log",
      },
      {
        title: "Fresh Log vs Old Log",
        description:
          "Why FixMyGame needs the newest log after a crash, not an older healthy session.",
        tag: "Important",
        href: "/guides/fresh-log-vs-old-log",
      },
    ],
  },
  {
    title: "Crash Fix Library",
    description: "Specific crash messages and common modded-game errors.",
    guides: [
      {
        title: "Minecraft JEI ClassNotFoundException Fix",
        description:
          "Fix crashes mentioning mezz.jei.api.runtime.IJeiRuntime or missing JEI classes.",
        tag: "Minecraft",
        href: "/guides/minecraft-jei-classnotfoundexception-fix",
      },
      {
        title: "Minecraft Java 17 UnsupportedClassVersionError Fix",
        description:
          "Fix Minecraft crashes caused by running the wrong Java version for your modpack.",
        tag: "Minecraft",
        href: "/guides/minecraft-unsupportedclassversionerror-java-17-fix",
      },
      {
        title: "Minecraft Fabric API Missing Dependency Fix",
        description:
          "What to do when a Fabric mod needs Fabric API before it can load.",
        tag: "Minecraft",
        href: "/guides/minecraft-fabric-api-missing-dependency-fix",
      },
      {
        title: "Stardew Valley SMAPI Empty Folder Fix",
        description:
          "Clean up SMAPI skipped-mod warnings caused by empty or invalid mod folders.",
        tag: "Stardew Valley",
        href: "/guides/stardew-smapi-empty-folder-skipped-mod-fix",
      },
      {
        title: "Lethal Company BepInEx LogOutput Fix",
        description:
          "Find the right BepInEx log and understand missing dependency issues.",
        tag: "Lethal Company",
        href: "/guides/lethal-company-bepinex-logoutput-fix",
      },
    ],
  },
  {
    title: "FixMyGame Help",
    description:
      "General troubleshooting concepts FixMyGame uses when reading logs.",
    guides: [
      {
        title: "Missing Dependencies",
        description:
          "What it means when a mod needs another mod installed before it can work.",
        tag: "Mods",
        href: "/guides/missing-dependencies",
      },
      {
        title: "Mod Conflicts",
        description:
          "How two mods can break each other and why removing one is sometimes the fix.",
        tag: "Troubleshooting",
        href: "/guides/mod-conflicts",
      },
      {
        title: "Safe Repair Preview",
        description:
          "What FixMyGame can safely help with and why backups matter before changes.",
        tag: "FixMyGame",
        href: "/guides/safe-repair-preview",
      },
      {
        title: "Verify or Reinstall Game Files",
        description:
          "Know when the issue is probably game files instead of your mods.",
        tag: "Game Files",
        href: "/guides/verify-or-reinstall-game-files",
      },
    ],
  },
];

export default function GuidesPage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "FixMyGame Guides",
    description:
      "Beginner-friendly crash log and modded PC game troubleshooting guides.",
    url: "https://fixmygame-site.vercel.app/guides",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionSchema),
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.12),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 md:px-10">
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-cyan-100"
          >
            ← FixMyGame Home
          </Link>
        </div>

        <main className="flex-1">
          <section className="py-12 md:py-7">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                FixMyGame Guides
              </div>

              <h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">
                Crash log help for
                <span className="block text-cyan-300">
                  modded PC games.
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                Beginner-friendly guides for crash logs, missing dependencies,
                mod conflicts, loader errors, corrupted game files, and safer
                troubleshooting before you start deleting mods.
              </p>
            </div>

            <div className="mt-10 space-y-10">
              {guideSections.map((section) => (
                <section key={section.title}>
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                      {section.title}
                    </div>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                      {section.description}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {section.guides.map((guide) => (
                      <Link
                        key={guide.title}
                        href={guide.href}
                        className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
                      >
                        <article>
                          <div className="mb-4 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                            {guide.tag}
                          </div>

                          <h2 className="text-lg font-semibold leading-snug">
  {guide.title}
</h2>

                          <p className="mt-2 text-sm leading-6 text-white/62">
  {guide.description}
</p>

                          <div className="mt-5 text-sm font-semibold text-cyan-300">
                            Open guide →
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="py-8 md:py-14">
            <div className="rounded-[28px] border border-white/10 bg-cyan-400/10 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Start here
              </div>

              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                Not sure which guide you need?
              </h2>

              <p className="mt-3 max-w-2xl text-white/72">
                If your game crashed, recreate the issue first, then open the
                newest crash or error log created after the problem happened.
                Old logs can look healthy even when the newest session is
                broken.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  "Recreate the crash or issue.",
                  "Find the newest log file.",
                  "Run it through FixMyGame.",
                ].map((step, index) => (
                  <div
                    key={step}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="text-lg font-bold text-cyan-300">
                      {index + 1}
                    </div>
                    <div className="mt-2 text-sm text-white/75">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}