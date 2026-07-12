import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Minecraft Fabric API Missing Dependency Fix | FixMyGame",
  description:
    "Fix Minecraft Fabric crashes caused by a missing Fabric API dependency, wrong Fabric API version, or a mod that requires Fabric API before it can load.",
  alternates: {
    canonical: "/guides/minecraft-fabric-api-missing-dependency-fix",
  },
  openGraph: {
    title: "Minecraft Fabric API Missing Dependency Fix",
    description:
      "A beginner-friendly guide to fixing Fabric mod crashes caused by missing or mismatched Fabric API files.",
    url: "/guides/minecraft-fabric-api-missing-dependency-fix",
    siteName: "FixMyGame",
    type: "article",
  },
};

export default function MinecraftFabricApiMissingDependencyFixPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Minecraft Fabric API Missing Dependency Fix",
    description:
      "A beginner-friendly guide to fixing Fabric mod crashes caused by missing or mismatched Fabric API files.",
    author: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    publisher: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/minecraft-fabric-api-missing-dependency-fix",
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.12),transparent_30%)]" />

      <div className="relative z-10 mx-auto min-h-screen w-full max-w-4xl px-6 py-8 md:px-10">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/guides"
            className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-cyan-100"
          >
            ← Back to Guides
          </Link>

          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            FixMyGame Home
          </Link>
        </div>

        <main className="py-12 md:py-7">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
            Minecraft
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Minecraft Fabric API Missing Dependency Fix
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            If your Fabric Minecraft crash log says a mod needs{" "}
            <span className="text-cyan-200">Fabric API</span>, the game is
            usually missing one of the core library files many Fabric mods rely
            on. The fix is usually simple: install the correct Fabric API file
            for your Minecraft version.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>

            <p className="mt-3 leading-7 text-white/70">
              Download Fabric API for your exact Minecraft version, place the
              Fabric API <span className="text-cyan-200">.jar</span> file in
              your mods folder, then relaunch Minecraft. Make sure your modpack
              is actually using Fabric, not Forge or NeoForge.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">What this error means</h2>

            <p className="mt-3 leading-7 text-white/75">
              Fabric API is a shared library used by many Fabric mods. When it
              is missing, those mods may fail before Minecraft reaches the main
              menu. This does not always mean the broken mod is bad — it may
              just be waiting for Fabric API to be installed.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Common signs in the crash log</h2>

            <div className="mt-4 grid gap-3">
              {[
                "Mod requires fabric-api",
                "depends on fabric-api",
                "Missing dependency fabric-api",
                "Fabric Loader could not load one or more mods",
                "A mod is missing required dependencies",
                "fabric-api is not installed",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">How to fix it</h2>

            <div className="mt-5 space-y-3">
              {[
                "Check the Minecraft version your Fabric profile uses.",
                "Confirm the profile is using Fabric Loader, not Forge or NeoForge.",
                "Download Fabric API for that exact Minecraft version.",
                "Move the Fabric API .jar file into the same mods folder as your other Fabric mods.",
                "Remove duplicate or outdated Fabric API files if you have more than one.",
                "Relaunch Minecraft and let it create a fresh log.",
                "If it still crashes, load the newest log into FixMyGame.",
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-slate-950">
                    {index + 1}
                  </div>

                  <div className="text-sm leading-6 text-white/75">{item}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">
              Make sure the version matches
            </h2>

            <p className="mt-3 leading-7 text-white/70">
              Fabric API versions are tied to Minecraft versions. A Fabric API
              file for Minecraft 1.20.1 may not work correctly in a 1.19.2
              modpack. Match the Minecraft version first, then check the Fabric
              Loader version if the crash continues.
            </p>

            <div className="mt-4 grid gap-3">
              {[
                "Minecraft version must match.",
                "Fabric Loader must be installed.",
                "Fabric API must be a .jar file inside the mods folder.",
                "Forge-only mods should not be mixed into a Fabric profile.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Do not do this yet</h2>

            <div className="mt-4 grid gap-3">
              {[
                "Do not delete the mod asking for Fabric API until you install the missing dependency first.",
                "Do not install Forge API or another loader file instead of Fabric API.",
                "Do not use a Fabric API file made for a different Minecraft version.",
                "Do not keep several old Fabric API files in the mods folder.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">FixMyGame tip</h2>

            <p className="mt-3 leading-7 text-white/75">
              If FixMyGame says Fabric API is missing but you already installed
              it, relaunch Minecraft and use the newest crash log. You may be
              looking at a log from before Fabric API was added.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Related Guides</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/guides/missing-dependencies"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">Missing Dependencies</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn what it means when a mod needs another mod installed
                  before it can load.
                </p>
              </Link>

              <Link
                href="/guides/minecraft-jei-classnotfoundexception-fix"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">
                  Minecraft JEI ClassNotFoundException Fix
                </h3>
                <p className="mt-2 text-sm text-white/65">
                  Fix crashes involving missing or mismatched Just Enough Items
                  files.
                </p>
              </Link>

              <Link
                href="/guides/minecraft-unsupportedclassversionerror-java-17-fix"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">
                  Minecraft Java 17 UnsupportedClassVersionError Fix
                </h3>
                <p className="mt-2 text-sm text-white/65">
                  Fix Minecraft crashes caused by running the wrong Java
                  version.
                </p>
              </Link>

              <Link
                href="/guides/fresh-log-vs-old-log"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">Fresh Log vs Old Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn why the newest crash log matters when diagnosing modded
                  game crashes.
                </p>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}