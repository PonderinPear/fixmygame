import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fresh Log vs Old Log: Why the Newest Crash Log Matters | FixMyGame",
  description:
    "Learn why the newest crash log is usually the only useful one when diagnosing modded PC game crashes, missing dependencies, mod conflicts, and loader errors.",
  alternates: {
    canonical: "/guides/fresh-log-vs-old-log",
  },
  openGraph: {
    title: "Fresh Log vs Old Log: Why the Newest Crash Log Matters",
    description:
      "A beginner-friendly guide explaining why old logs can hide the real crash and why FixMyGame needs the newest log.",
    url: "/guides/fresh-log-vs-old-log",
    siteName: "FixMyGame",
    type: "article",
  },
};

export default function FreshLogVsOldLogPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Fresh Log vs Old Log: Why the Newest Crash Log Matters",
    description:
      "A beginner-friendly guide explaining why old logs can hide the real crash and why FixMyGame needs the newest log.",
    author: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    publisher: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/fresh-log-vs-old-log",
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
            Important
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Fresh Log vs Old Log: Why the Newest Crash Log Matters
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            A fresh log is the crash or error log created right after the
            problem happens. An old log may come from a different session and
            can make the issue look completely different from what actually
            broke.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>
            <p className="mt-3 leading-7 text-white/70">
              Use the newest log created immediately after the crash. If you
              upload an older log, FixMyGame may diagnose a past warning,
              normal startup message, or healthy session instead of the real
              crash.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">What is a fresh log?</h2>
            <p className="mt-3 leading-7 text-white/75">
              A fresh log is made during the same session where the crash,
              freeze, failed launch, or mod error happened. It is the log most
              likely to include the real final error, missing dependency,
              version mismatch, or mod conflict.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Why old logs can be misleading</h2>
            <div className="mt-5 grid gap-3">
              {[
                "They may be from a session where the game loaded normally.",
                "They may show warnings that are unrelated to the current crash.",
                "They may point to a mod you already fixed or removed.",
                "They may hide the newest final crash reason.",
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

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">How to get the right log</h2>
            <div className="mt-5 space-y-3">
              {[
                "Open the game or mod loader.",
                "Recreate the crash or error.",
                "Close the game after the issue happens.",
                "Find the newest crash, error, SMAPI, BepInEx, Forge, Fabric, or loader log.",
                "Upload that newest file into FixMyGame.",
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
              If a diagnosis looks wrong, recreate the crash and upload the
              newest log again. A better log usually means a better diagnosis.
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
                  Learn what parts of a crash log matter most when diagnosing a
                  crash.
                </p>
              </Link>

              <Link
                href="/guides/missing-dependencies"
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <h3 className="font-semibold">Missing Dependencies</h3>
                <p className="mt-2 text-sm text-white/65">
                  Understand errors caused by required mods that are missing or
                  outdated.
                </p>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}