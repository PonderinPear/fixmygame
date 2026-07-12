import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mod Conflicts: How to Tell When Mods Are Fighting | FixMyGame",
  description:
    "Learn what mod conflicts are, how to spot them in crash logs, and why testing one mod change at a time is safer than deleting everything.",
  alternates: {
    canonical: "/guides/mod-conflicts",
  },
  openGraph: {
    title: "Mod Conflicts: How to Tell When Mods Are Fighting",
    description:
      "A beginner-friendly guide to mod conflicts, repeated crash errors, compatibility issues, and safer testing.",
    url: "/guides/mod-conflicts",
    siteName: "FixMyGame",
    type: "article",
  },
};

const conflictSigns = [
  {
    title: "Two mods change the same thing",
    text: "A conflict can happen when multiple mods edit the same item, file, event, character, system, or game behavior.",
  },
  {
    title: "The game crashes after adding one mod",
    text: "If everything worked before a new mod was added, that new mod or one of its interactions is the first place to check.",
  },
  {
    title: "Errors mention multiple mods",
    text: "Sometimes the log points to more than one mod because the crash is caused by the way they interact together.",
  },
  {
    title: "The issue only happens in a specific situation",
    text: "A conflict may only appear when loading a save, opening a menu, entering an area, using an item, or triggering a certain event.",
  },
];

const conflictChecklist = [
  "Sort mods by the date you added or updated them",
  "Temporarily disable the newest mod first",
  "Test the game after each change",
  "Look for mods that edit the same feature",
  "Check if one mod has a compatibility patch for another",
];

export default function ModConflictsPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Mod Conflicts: How to Tell When Mods Are Fighting",
    description:
      "A beginner-friendly guide to mod conflicts, repeated crash errors, compatibility issues, and safer testing.",
    author: { "@type": "Organization", name: "FixMyGame" },
    publisher: { "@type": "Organization", name: "FixMyGame" },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/mod-conflicts",
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
          <Link href="/guides" className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-cyan-100">
            ← Back to Guides
          </Link>

          <Link href="/" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white">
            FixMyGame Home
          </Link>
        </div>

        <main className="py-12 md:py-7">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
            Troubleshooting
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Mod Conflicts: How to Tell When Mods Are Fighting
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            A mod conflict happens when two or more mods do not work well
            together. One mod may overwrite another, change the same file, expect
            a different version, or break only when another mod is also active.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>
            <p className="mt-3 leading-7 text-white/70">
              A mod conflict is likely when the crash starts after adding or
              updating a mod, multiple mods appear near the same error, or the
              issue only happens during a specific action. Test one change at a
              time instead of deleting your whole mod folder.
            </p>
          </section>

          <section className="mt-10 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              Simple meaning
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              The mods are fighting over the same space
            </h2>

            <p className="mt-3 leading-7 text-white/75">
              A mod can be perfectly fine by itself but crash when another mod
              changes the same part of the game. That is why removing one random
              mod may not fix everything unless you test the conflict carefully.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">
              Signs your crash is a mod conflict
            </h2>

            <div className="mt-5 grid gap-3">
              {conflictSigns.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="font-semibold text-cyan-200">{item.title}</div>
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
              {conflictChecklist.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-slate-950">
                    {index + 1}
                  </div>
                  <div className="text-sm leading-6 text-white/75">{item}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Do not delete everything first</h2>

            <p className="mt-3 leading-7 text-white/70">
              The fastest fix is not always removing your whole mod folder. It is
              usually better to test in small groups, starting with the newest or
              most suspicious mods. That way you can find the real conflict
              without destroying your setup.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">FixMyGame tip</h2>

            <p className="mt-3 leading-7 text-white/75">
              If FixMyGame points to a possible conflict, back up your save or
              mod folder before removing anything. Then test one change at a
              time so you know which mod actually caused the problem.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Related Guides</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link href="/guides/how-to-read-a-crash-log" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10">
                <h3 className="font-semibold">How to Read a Crash Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn where to look when multiple mods appear near an error.
                </p>
              </Link>

              <Link href="/guides/missing-dependencies" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10">
                <h3 className="font-semibold">Missing Dependencies</h3>
                <p className="mt-2 text-sm text-white/65">
                  Rule out missing required mods before blaming a conflict.
                </p>
              </Link>

              <Link href="/guides/safe-repair-preview" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10">
                <h3 className="font-semibold">Safe Repair Preview</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn why backups matter before removing or quarantining mods.
                </p>
              </Link>

              <Link href="/guides/verify-or-reinstall-game-files" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10">
                <h3 className="font-semibold">Verify or Reinstall Game Files</h3>
                <p className="mt-2 text-sm text-white/65">
                  Check if the crash is caused by damaged game files instead.
                </p>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}