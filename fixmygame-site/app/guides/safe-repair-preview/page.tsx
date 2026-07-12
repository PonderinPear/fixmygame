import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Safe Repair Preview: Fix Modded Game Crashes Safely | FixMyGame",
  description:
    "Learn what Safe Repair Preview means, why FixMyGame shows planned fixes first, and how backups help protect your modded game files.",
  alternates: {
    canonical: "/guides/safe-repair-preview",
  },
  openGraph: {
    title: "Safe Repair Preview: Fix Modded Game Crashes Safely",
    description:
      "A beginner-friendly guide to safe repair previews, backups, undo steps, and safer mod troubleshooting.",
    url: "/guides/safe-repair-preview",
    siteName: "FixMyGame",
    type: "article",
  },
};

const safeRepairCanDo = [
  {
    title: "Show the planned fix first",
    text: "A safe repair should explain what it wants to change before anything is moved, removed, or edited.",
  },
  {
    title: "Use backups when possible",
    text: "If something needs to be moved or changed, a backup gives you a way to undo the repair.",
  },
  {
    title: "Avoid risky automatic edits",
    text: "Some problems should stay manual if the app cannot safely confirm the exact fix.",
  },
  {
    title: "Keep the user in control",
    text: "The goal is guided repair, not surprise changes to your game files.",
  },
];

const beforeRepairChecklist = [
  "Read what the repair is about to do",
  "Make sure the game is closed",
  "Back up saves or important mod folders",
  "Only repair one issue at a time",
  "Retest the game after the repair",
];

export default function SafeRepairPreviewPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Safe Repair Preview: Fix Modded Game Crashes Safely",
    description:
      "A beginner-friendly guide to safe repair previews, backups, undo steps, and safer mod troubleshooting.",
    author: { "@type": "Organization", name: "FixMyGame" },
    publisher: { "@type": "Organization", name: "FixMyGame" },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/safe-repair-preview",
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
            FixMyGame
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Safe Repair Preview: Fix Modded Game Crashes Safely
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            Safe Repair Preview shows what FixMyGame thinks should be done
            before anything changes. The goal is to help users fix broken setups
            without blindly deleting mods, moving files, or making changes they
            cannot undo.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>
            <p className="mt-3 leading-7 text-white/70">
              Safe Repair Preview means FixMyGame shows the planned repair
              before touching your files. A good repair should explain the
              issue, show what will change, use backups when possible, and keep
              risky fixes manual.
            </p>
          </section>

          <section className="mt-10 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              Simple meaning
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              Preview the fix before touching files
            </h2>

            <p className="mt-3 leading-7 text-white/75">
              A safe repair should feel like a clear warning label: here is what
              seems broken, here is what the repair would do, and here is what
              can be undone if something does not work.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">What Safe Repair should do</h2>

            <div className="mt-5 grid gap-3">
              {safeRepairCanDo.map((item) => (
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
            <h2 className="text-2xl font-bold">Before you run a repair</h2>

            <div className="mt-5 space-y-3">
              {beforeRepairChecklist.map((item, index) => (
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
            <h2 className="text-2xl font-bold">What should stay manual</h2>

            <p className="mt-3 leading-7 text-white/70">
              Some fixes should not be automatic. If the issue involves choosing
              the correct mod version, reinstalling a whole game, changing a
              launcher setting, or deleting something permanent, FixMyGame should
              explain the steps instead of forcing the repair.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">FixMyGame tip</h2>

            <p className="mt-3 leading-7 text-white/75">
              Treat Safe Repair Preview like a safety checkpoint. If the repair
              does not clearly say what it will change, do not run it yet. The
              best repair is one you understand and can undo.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Related Guides</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/guides/mod-conflicts"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Mod Conflicts</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn why removing one suspicious mod at a time is safer than
                  deleting everything.
                </p>
              </Link>

              <Link
                href="/guides/missing-dependencies"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Missing Dependencies</h3>
                <p className="mt-2 text-sm text-white/65">
                  Understand when the safest fix is installing a required mod or
                  library.
                </p>
              </Link>

              <Link
                href="/guides/verify-or-reinstall-game-files"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">
                  Verify or Reinstall Game Files
                </h3>
                <p className="mt-2 text-sm text-white/65">
                  Know when a repair should stay manual because the game files
                  may be damaged.
                </p>
              </Link>

              <Link
                href="/guides/how-to-read-a-crash-log"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">How to Read a Crash Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn what clues FixMyGame looks for before suggesting a
                  repair.
                </p>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}