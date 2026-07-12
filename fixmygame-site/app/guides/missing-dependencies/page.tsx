import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Missing Dependencies in Modded Games: What It Means | FixMyGame",
  description:
    "Learn what missing dependency errors mean in modded PC games, why mods fail without required libraries or loaders, and what to check first.",
  alternates: {
    canonical: "/guides/missing-dependencies",
  },
  openGraph: {
    title: "Missing Dependencies in Modded Games",
    description:
      "A beginner-friendly guide to missing dependency errors, required mods, helper libraries, and loader mismatches.",
    url: "/guides/missing-dependencies",
    siteName: "FixMyGame",
    type: "article",
  },
};

const dependencySigns = [
  {
    title: "Required mod missing",
    text: "The log may say that one mod depends on another mod that is not installed.",
  },
  {
    title: "Dependency version is wrong",
    text: "The needed mod is installed, but it may be too old, too new, or made for a different game version.",
  },
  {
    title: "Loader mismatch",
    text: "A mod may require Forge, Fabric, Quilt, SMAPI, SKSE, or another loader version that does not match your setup.",
  },
  {
    title: "Mod loads, then fails",
    text: "Sometimes the main mod is present, but it fails during startup because a helper library is missing.",
  },
];

const whatToCheck = [
  "The mod page for required files or dependencies",
  "The game version the mod was made for",
  "The mod loader version required",
  "Whether the dependency is installed in the correct mods folder",
  "Whether you accidentally downloaded the wrong file version",
];

export default function MissingDependenciesPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Missing Dependencies in Modded Games: What It Means",
    description:
      "A beginner-friendly guide to missing dependency errors, required mods, helper libraries, and loader mismatches.",
    author: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    publisher: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/missing-dependencies",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.12),transparent_30%)]" />

      <div className="relative mx-auto min-h-screen w-full max-w-4xl px-6 py-8 md:px-10">
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
            Mods
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Missing Dependencies in Modded Games
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            A missing dependency means one mod needs another mod, library, or
            loader to work. The main mod may be installed correctly, but the
            game can still crash if one of its required pieces is missing or the
            wrong version.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>
            <p className="mt-3 leading-7 text-white/70">
              To fix a missing dependency error, check the mod page for required
              files, install the missing required mod or library, make sure it
              matches your game and loader version, then relaunch the game and
              check a fresh log.
            </p>
          </section>

          <section className="mt-10 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              Simple meaning
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              The mod is asking for something else
            </h2>

            <p className="mt-3 leading-7 text-white/75">
              Think of it like downloading a game expansion without the base
              game. The mod might be real and installed, but it cannot fully run
              until the thing it depends on is also installed.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">
              Signs your crash is a dependency issue
            </h2>

            <div className="mt-5 grid gap-3">
              {dependencySigns.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="font-semibold text-cyan-200">
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">What to check first</h2>

            <div className="mt-5 space-y-3">
              {whatToCheck.map((item, index) => (
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

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Common example</h2>

            <p className="mt-3 leading-7 text-white/70">
              In Stardew Valley, a mod may need Content Patcher. If Content
              Patcher is missing, outdated, or not loaded correctly, the mod
              depending on it can fail even though the original mod is sitting in
              the Mods folder.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">FixMyGame tip</h2>

            <p className="mt-3 leading-7 text-white/75">
              If FixMyGame says a dependency is missing but you already
              installed it, run the game again and load the newest log. The app
              needs a fresh log to confirm whether the dependency is still
              failing.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Related Guides</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/guides/how-to-read-a-crash-log"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">How to Read a Crash Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn where to look in a log when the error text feels
                  overwhelming.
                </p>
              </Link>

              <Link
                href="/guides/fresh-log-vs-old-log"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Fresh Log vs Old Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Make sure you are diagnosing the crash that just happened.
                </p>
              </Link>

              <Link
                href="/guides/mod-conflicts"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Mod Conflicts</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn how two mods can interfere with each other.
                </p>
              </Link>

              <Link
                href="/guides/safe-repair-preview"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Safe Repair Preview</h3>
                <p className="mt-2 text-sm text-white/65">
                  Understand what FixMyGame can safely suggest before changing
                  files.
                </p>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}