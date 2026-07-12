import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stardew Valley SMAPI Empty Folder Skipped Mod Fix | FixMyGame",
  description:
    "Fix Stardew Valley SMAPI skipped-mod warnings caused by empty mod folders, invalid mod folders, or incomplete mod installs.",
  alternates: {
    canonical: "/guides/stardew-smapi-empty-folder-skipped-mod-fix",
  },
  openGraph: {
    title: "Stardew Valley SMAPI Empty Folder Skipped Mod Fix",
    description:
      "A beginner-friendly guide to cleaning up SMAPI skipped-mod warnings caused by empty or invalid Stardew Valley mod folders.",
    url: "/guides/stardew-smapi-empty-folder-skipped-mod-fix",
    siteName: "FixMyGame",
    type: "article",
  },
};

export default function StardewSmapiEmptyFolderSkippedModFixPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Stardew Valley SMAPI Empty Folder Skipped Mod Fix",
    description:
      "A beginner-friendly guide to cleaning up SMAPI skipped-mod warnings caused by empty or invalid Stardew Valley mod folders.",
    author: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    publisher: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/stardew-smapi-empty-folder-skipped-mod-fix",
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
            Stardew Valley
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Stardew Valley SMAPI Empty Folder Skipped Mod Fix
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            If your Stardew Valley SMAPI log says a mod was{" "}
            <span className="text-cyan-200">skipped because it is an empty folder</span>,
            the issue is usually not a full crash. It means SMAPI found a folder
            inside your Mods folder, but that folder does not contain a valid
            Stardew mod.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>

            <p className="mt-3 leading-7 text-white/70">
              Open your Stardew Valley Mods folder, find the empty or invalid
              folder named in the SMAPI log, and remove it. Then launch Stardew
              Valley again so SMAPI creates a fresh log.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">What this warning means</h2>

            <p className="mt-3 leading-7 text-white/75">
              SMAPI checks every folder inside your Stardew Valley Mods folder.
              If it finds a folder with no mod files inside, it skips that
              folder and adds a warning to the log. This can happen after an
              incomplete download, a failed extraction, or accidentally placing
              the wrong folder into Mods.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Common signs in the SMAPI log</h2>

            <div className="mt-4 grid gap-3">
              {[
                "Skipped mods",
                "because it's an empty folder",
                "Failed: it's an empty folder",
                "from Mods\\",
                "This mod could not be added to your game",
                "SMAPI found a folder but no valid manifest.json",
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
                "Open your Stardew Valley Mods folder.",
                "Find the folder named in the SMAPI skipped-mod warning.",
                "Open that folder and check whether it is empty or missing mod files.",
                "Remove the empty folder from your Mods folder.",
                "If it was supposed to be a real mod, redownload and reinstall the mod correctly.",
                "Launch Stardew Valley again so SMAPI creates a fresh log.",
                "Load the newest SMAPI log into FixMyGame if the warning or crash continues.",
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
            <h2 className="text-2xl font-bold">Where the Mods folder usually is</h2>

            <p className="mt-3 leading-7 text-white/70">
              On many Windows Steam installs, the Stardew Valley Mods folder is
              usually inside the Stardew Valley game folder.
            </p>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm leading-6 text-cyan-100">
              C:\Program Files (x86)\Steam\steamapps\common\Stardew Valley\Mods
            </div>

            <p className="mt-4 text-sm leading-6 text-white/60">
              Your folder may be different if you installed Stardew Valley in a
              custom Steam library or through another launcher.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">This may not be a crash</h2>

            <p className="mt-3 leading-7 text-white/70">
              An empty folder warning can make the SMAPI log look scary, but it
              is often just cleanup. If Stardew Valley still opens normally,
              removing the empty folder may be enough. If the game actually
              crashes, use the newest SMAPI log after the crash happens.
            </p>

            <div className="mt-4 grid gap-3">
              {[
                "If the game opens normally, clean up the empty folder and retest.",
                "If the game crashes, recreate the crash and use the newest SMAPI log.",
                "If the same warning stays after removal, you may be reading an old log.",
                "If the folder returns, a mod manager or installer may be recreating it.",
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
                "Do not delete all your mods because of one empty folder warning.",
                "Do not remove SMAPI itself unless the log says SMAPI is broken.",
                "Do not assume the empty folder is the cause of a separate crash.",
                "Do not use an old SMAPI log to check whether the cleanup worked.",
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
              If FixMyGame identifies an empty Stardew mod folder, remove that
              folder, launch Stardew Valley again, and then use the newest SMAPI
              log to confirm the warning is gone.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Related Guides</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/guides/fresh-log-vs-old-log"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">Fresh Log vs Old Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn why the newest SMAPI log matters when checking whether a
                  warning was actually fixed.
                </p>
              </Link>

              <Link
                href="/guides/how-to-read-a-crash-log"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">How to Read a Crash Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn what parts of a crash log matter most when diagnosing a
                  modded game issue.
                </p>
              </Link>

              <Link
                href="/guides/mod-conflicts"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">Mod Conflicts</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn how two mods can interfere with each other and cause
                  crashes.
                </p>
              </Link>

              <Link
                href="/guides/safe-repair-preview"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">Safe Repair Preview</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn how FixMyGame thinks about safe cleanup, backups, and
                  reversible changes.
                </p>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}