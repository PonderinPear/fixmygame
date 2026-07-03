import Link from "next/link";

export default function howToReadACrashLog() {
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
            Crash logs look scary, but most of the time you are looking for a
            few useful clues: the newest error, the mod name, missing dependency
            messages, version mismatch messages, or the final crash reason.
          </p>

          <section className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Start with the newest log</h2>
            <p className="mt-3 leading-7 text-white/70">
              Always use the log created right after the crash or problem
              happened. Older logs may show a normal session and can make the
              problem look like nothing is wrong.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Look for the real clue</h2>
            <div className="mt-4 grid gap-3">
              {[
                "A mod name near the error",
                "Missing dependency or required mod messages",
                "Wrong game version or wrong loader version",
                "Repeated errors from the same file or mod",
                "The final crash message near the bottom of the log",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">FixMyGame tip</h2>
            <p className="mt-3 leading-7 text-white/75">
              If FixMyGame says no clear issue was found, recreate the crash and
              load the newest log after the issue happens again.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}