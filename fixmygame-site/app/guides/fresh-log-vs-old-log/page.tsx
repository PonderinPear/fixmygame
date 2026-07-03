import Link from "next/link";

const clueCards = [
  {
    title: "The newest error",
    text: "Look near the bottom of the log first. The most recent error is usually more useful than random warnings at the top.",
  },
  {
    title: "A repeated mod name",
    text: "If the same mod, file, or folder name keeps appearing around errors, that mod is worth checking first.",
  },
  {
    title: "Missing dependency messages",
    text: "These usually mean a mod is installed, but one of the extra mods it needs is missing or outdated.",
  },
  {
    title: "Version mismatch messages",
    text: "These happen when the game, mod loader, or mod version does not match what the setup expects.",
  },
  {
    title: "The final crash reason",
    text: "The final exception or crash reason can point to the real problem, even when the log has a lot of noise.",
  },
];

const ignoreForNow = [
  "One-time warnings that do not repeat",
  "Old errors from a previous game session",
  "Normal loading messages",
  "Huge sections of technical text with no mod name nearby",
];

export default function HowToReadCrashLogPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
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
            Beginner
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            How to read a crash log
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            Crash logs look overwhelming, but you do not need to understand
            every line. Most of the time, you are looking for a few useful clues:
            the newest error, a repeated mod name, a missing dependency, a
            version mismatch, or the final crash reason.
          </p>

          <section className="mt-10 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              First rule
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              Start with the newest log
            </h2>

            <p className="mt-3 leading-7 text-white/75">
              Use the log created right after the crash or problem happened. An
              old log can look normal because it may be from a healthy game
              session, not the broken one.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">What to look for</h2>

            <div className="mt-5 grid gap-3">
              {clueCards.map((item) => (
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
            <h2 className="text-2xl font-bold">What you can ignore at first</h2>

            <p className="mt-3 leading-7 text-white/70">
              Not every scary-looking line is the real issue. Logs can include
              harmless warnings, normal loading messages, and old information
              from earlier sessions.
            </p>

            <div className="mt-5 grid gap-3">
              {ignoreForNow.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Simple crash log checklist</h2>

            <div className="mt-5 space-y-3">
              {[
                "Did this log happen after the crash?",
                "Does the same mod name appear more than once?",
                "Does it say something is missing or required?",
                "Does it mention the wrong game, mod, or loader version?",
                "Does the bottom of the log show a clearer crash reason?",
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

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">FixMyGame tip</h2>

            <p className="mt-3 leading-7 text-white/75">
              If FixMyGame says no clear issue was found, recreate the crash and
              load the newest log after the issue happens again. A healthy log
              usually means the app did not receive the broken session yet.
            </p>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/guides/fresh-log-vs-old-log"
              className="inline-flex items-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Next: Fresh log vs old log →
            </Link>

            <Link
              href="/guides"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              View all guides
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}