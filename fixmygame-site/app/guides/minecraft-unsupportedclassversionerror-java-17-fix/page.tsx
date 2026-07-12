import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Minecraft Java 17 UnsupportedClassVersionError Fix | FixMyGame",
  description:
    "Fix Minecraft UnsupportedClassVersionError crashes caused by using the wrong Java version, especially Java 8 instead of Java 17 for newer modpacks.",
  alternates: {
    canonical: "/guides/minecraft-unsupportedclassversionerror-java-17-fix",
  },
  openGraph: {
    title: "Minecraft Java 17 UnsupportedClassVersionError Fix",
    description:
      "A beginner-friendly guide to fixing Minecraft crashes caused by running the wrong Java version for your modpack.",
    url: "/guides/minecraft-unsupportedclassversionerror-java-17-fix",
    siteName: "FixMyGame",
    type: "article",
  },
};

export default function MinecraftUnsupportedClassVersionErrorJava17FixPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Minecraft Java 17 UnsupportedClassVersionError Fix",
    description:
      "A beginner-friendly guide to fixing Minecraft crashes caused by running the wrong Java version for your modpack.",
    author: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    publisher: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/minecraft-unsupportedclassversionerror-java-17-fix",
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
            Minecraft Java 17 UnsupportedClassVersionError Fix
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            If your Minecraft crash log says{" "}
            <span className="text-cyan-200">UnsupportedClassVersionError</span>,
            your modpack is probably running with the wrong Java version. This
            is common when a newer Minecraft version needs Java 17, but the
            launcher is still using Java 8.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>

            <p className="mt-3 leading-7 text-white/70">
              Install Java 17 and set your Minecraft launcher, CurseForge,
              Prism Launcher, Modrinth, or custom profile to use Java 17. Then
              relaunch the game and load a fresh crash log if the issue
              continues.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">What this error means</h2>

            <p className="mt-3 leading-7 text-white/75">
              UnsupportedClassVersionError means Java tried to load a file that
              was built for a newer Java version than the one currently running.
              The mod itself may be fine — the launcher may just be pointing at
              an older Java install.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Common signs in the crash log</h2>

            <div className="mt-4 grid gap-3">
              {[
                "java.lang.UnsupportedClassVersionError",
                "Unsupported class file major version",
                "has been compiled by a more recent version of the Java Runtime",
                "class file version 61.0",
                "Java 8 is being used with a Java 17 modpack",
                "The launcher is pointing to the wrong Java path",
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
                "Check the Minecraft version your modpack uses.",
                "For many Minecraft 1.18+ modpacks, install or select Java 17.",
                "Open your launcher settings for that profile or instance.",
                "Find the Java executable or Java version setting.",
                "Point the launcher to Java 17 instead of Java 8.",
                "Save the profile, relaunch Minecraft, and test again.",
                "If it still crashes, load the newest log created after that relaunch.",
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
            <h2 className="text-2xl font-bold">Which Java version do I need?</h2>

            <div className="mt-4 grid gap-3">
              {[
                "Minecraft 1.16.5 and older modpacks often use Java 8.",
                "Minecraft 1.17 commonly uses Java 16.",
                "Minecraft 1.18, 1.19, and 1.20 modpacks usually use Java 17.",
                "Some newer setups may require a newer Java version, so always check the modpack notes.",
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
                "Do not delete random mods before checking the Java version.",
                "Do not reinstall the entire modpack first if the log clearly says UnsupportedClassVersionError.",
                "Do not assume the newest Java always fixes every Minecraft version.",
                "Do not change every launcher setting at once. Change Java first, then retest.",
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
              If FixMyGame says Java mismatch but you already installed Java 17,
              check the launcher profile. Installing Java 17 is not enough if
              the launcher is still using an older Java path.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Related Guides</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/guides/how-to-read-a-crash-log"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">How to Read a Crash Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn what parts of a crash log actually matter and what can
                  usually be ignored.
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
                href="/guides/missing-dependencies"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">Missing Dependencies</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn what it means when a mod needs another mod installed
                  before it can load.
                </p>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}