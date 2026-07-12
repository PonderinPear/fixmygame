import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Verify or Reinstall Game Files: What to Try First | FixMyGame",
  description:
    "Learn when to verify game files, when to reinstall, and why checking corrupted or missing base game files is safer before deleting mods.",
  alternates: {
    canonical: "/guides/verify-or-reinstall-game-files",
  },
  openGraph: {
    title: "Verify or Reinstall Game Files: What to Try First",
    description:
      "A beginner-friendly guide to verifying game files, corrupted installs, launcher repair tools, and safer reinstall decisions.",
    url: "/guides/verify-or-reinstall-game-files",
    siteName: "FixMyGame",
    type: "article",
  },
};

const whenToVerify = [
  {
    title: "The game crashes without mods",
    text: "If the game still breaks after mods are disabled, the issue may be with the base game files instead of the mod setup.",
  },
  {
    title: "Files were deleted or moved",
    text: "Missing game files can happen after manual cleanup, failed installs, antivirus quarantine, or moving folders around.",
  },
  {
    title: "The launcher reports broken files",
    text: "Steam, Xbox, Epic, or another launcher may detect that the install is damaged or incomplete.",
  },
  {
    title: "The game updated recently",
    text: "A new update can leave old modded files behind or make parts of the install mismatch the current version.",
  },
];

const repairOrder = [
  "Close the game and launcher completely",
  "Back up saves and important mod folders",
  "Verify game files through your launcher",
  "Test the game with mods disabled",
  "Only reinstall if verifying does not fix the issue",
];

export default function VerifyOrReinstallGameFilesPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Verify or Reinstall Game Files: What to Try First",
    description:
      "A beginner-friendly guide to verifying game files, corrupted installs, launcher repair tools, and safer reinstall decisions.",
    author: { "@type": "Organization", name: "FixMyGame" },
    publisher: { "@type": "Organization", name: "FixMyGame" },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/verify-or-reinstall-game-files",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
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
            Game Files
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Verify or Reinstall Game Files: What to Try First
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            Sometimes the problem is not a single mod. The base game files may
            be missing, corrupted, outdated, or mismatched after an update.
            Verifying files is usually safer than reinstalling because it checks
            the install first without wiping everything.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>
            <p className="mt-3 leading-7 text-white/70">
              Verify game files first if the game crashes without mods, files
              were moved or deleted, or the launcher reports a damaged install.
              Reinstall only after backing up saves and trying verification.
            </p>
          </section>

          <section className="mt-10 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              Simple meaning
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              Check the game before replacing the game
            </h2>

            <p className="mt-3 leading-7 text-white/75">
              Verifying game files asks your launcher to scan the install and
              replace missing or damaged files. Reinstalling is a bigger step and
              should usually come after verification does not help.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">
              Signs you may need to verify files
            </h2>

            <div className="mt-5 grid gap-3">
              {whenToVerify.map((item) => (
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
            <h2 className="text-2xl font-bold">Best order to try</h2>

            <div className="mt-5 space-y-3">
              {repairOrder.map((item, index) => (
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
            <h2 className="text-2xl font-bold">Verify before you reinstall</h2>

            <p className="mt-3 leading-7 text-white/70">
              Reinstalling can take longer and may remove local files depending
              on the game, launcher, and folder setup. Verifying is usually the
              cleaner first step because it tries to repair the install without
              starting over.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">FixMyGame tip</h2>

            <p className="mt-3 leading-7 text-white/75">
              If FixMyGame points to game file corruption, do not delete your
              whole game immediately. Back up saves and mod folders first, then
              verify the game files through the launcher before trying a full
              reinstall.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Related Guides</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/guides/safe-repair-preview"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Safe Repair Preview</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn why FixMyGame previews safer repairs before changing
                  files.
                </p>
              </Link>

              <Link
                href="/guides/mod-conflicts"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Mod Conflicts</h3>
                <p className="mt-2 text-sm text-white/65">
                  Rule out mod conflicts before assuming the whole game install
                  is broken.
                </p>
              </Link>

              <Link
                href="/guides/missing-dependencies"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Missing Dependencies</h3>
                <p className="mt-2 text-sm text-white/65">
                  Check whether the crash is really caused by a missing required
                  mod.
                </p>
              </Link>

              <Link
                href="/guides/how-to-read-a-crash-log"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">How to Read a Crash Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn how to tell whether the log points to mods or base game
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