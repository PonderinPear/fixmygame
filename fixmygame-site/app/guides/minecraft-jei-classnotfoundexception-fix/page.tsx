import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Minecraft JEI ClassNotFoundException Fix | FixMyGame",
  description:
    "Fix Minecraft crashes mentioning mezz.jei.api.runtime.IJeiRuntime, JEI classes, ClassNotFoundException, missing dependencies, or mismatched Just Enough Items versions.",
  alternates: {
    canonical: "/guides/minecraft-jei-classnotfoundexception-fix",
  },
  openGraph: {
    title: "Minecraft JEI ClassNotFoundException Fix",
    description:
      "A beginner-friendly guide to fixing Minecraft crashes caused by missing, outdated, or mismatched Just Enough Items / JEI files.",
    url: "/guides/minecraft-jei-classnotfoundexception-fix",
    siteName: "FixMyGame",
    type: "article",
  },
};

export default function MinecraftJeiClassNotFoundExceptionFixPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Minecraft JEI ClassNotFoundException Fix",
    description:
      "A beginner-friendly guide to fixing Minecraft crashes caused by missing, outdated, or mismatched Just Enough Items / JEI files.",
    author: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    publisher: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/minecraft-jei-classnotfoundexception-fix",
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
            Minecraft JEI ClassNotFoundException Fix
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            If your Minecraft crash log mentions{" "}
            <span className="text-cyan-200">ClassNotFoundException</span>,{" "}
            <span className="text-cyan-200">mezz.jei</span>, or{" "}
            <span className="text-cyan-200">IJeiRuntime</span>, the problem is
            usually connected to Just Enough Items, also called JEI, or a mod
            that expects JEI to be installed.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>

            <p className="mt-3 leading-7 text-white/70">
              Install or update the correct JEI version for your exact Minecraft
              version and loader. Make sure you are not mixing Forge JEI with a
              Fabric modpack, or Fabric JEI with a Forge modpack. Then relaunch
              Minecraft and use a fresh crash log if it still fails.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">What this crash usually means</h2>

            <p className="mt-3 leading-7 text-white/75">
              A JEI ClassNotFoundException means Minecraft tried to load a JEI
              class, but that class was not available. That usually happens when
              JEI is missing, installed for the wrong loader, installed for the
              wrong Minecraft version, or when another mod expects a newer or
              older JEI API.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Common signs in the crash log</h2>

            <div className="mt-4 grid gap-3">
              {[
                "java.lang.ClassNotFoundException",
                "mezz.jei.api.runtime.IJeiRuntime",
                "mezz.jei",
                "Just Enough Items",
                "A mod failed to load correctly",
                "Missing or incompatible dependency",
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
                "Check your Minecraft version, such as 1.20.1, 1.19.2, or 1.18.2.",
                "Check your loader: Forge, Fabric, Quilt, or NeoForge.",
                "Download the JEI version that matches both your Minecraft version and loader.",
                "Remove any old or duplicate JEI files from your mods folder.",
                "Put the correct JEI file into the same mods folder as the rest of your modpack.",
                "Relaunch Minecraft and let it create a fresh log.",
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
            <h2 className="text-2xl font-bold">Do not do this yet</h2>

            <div className="mt-4 grid gap-3">
              {[
                "Do not delete random mods before checking whether JEI is simply missing.",
                "Do not install the newest JEI blindly if your modpack uses an older Minecraft version.",
                "Do not mix Forge and Fabric versions of JEI.",
                "Do not keep multiple JEI files in the mods folder unless the modpack specifically requires it.",
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
              If FixMyGame says JEI is missing but you already installed it,
              relaunch Minecraft first and load the newest log. The log may be
              from before JEI was added.
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
                href="/guides/minecraft-fabric-api-missing-dependency-fix"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">
                  Minecraft Fabric API Missing Dependency Fix
                </h3>
                <p className="mt-2 text-sm text-white/65">
                  Fix crashes where a Fabric mod needs Fabric API before it can
                  load.
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