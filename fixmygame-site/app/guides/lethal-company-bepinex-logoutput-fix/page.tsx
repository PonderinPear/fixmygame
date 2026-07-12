import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lethal Company BepInEx LogOutput Fix | FixMyGame",
  description:
    "Learn how to find the correct Lethal Company BepInEx LogOutput.log file, avoid uploading manifest.json, and diagnose missing dependencies or modpack issues.",
  alternates: {
    canonical: "/guides/lethal-company-bepinex-logoutput-fix",
  },
  openGraph: {
    title: "Lethal Company BepInEx LogOutput Fix",
    description:
      "A beginner-friendly guide to finding the right BepInEx LogOutput.log file for Lethal Company crashes and mod errors.",
    url: "/guides/lethal-company-bepinex-logoutput-fix",
    siteName: "FixMyGame",
    type: "article",
  },
};

export default function LethalCompanyBepInExLogOutputFixPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Lethal Company BepInEx LogOutput Fix",
    description:
      "A beginner-friendly guide to finding the right BepInEx LogOutput.log file for Lethal Company crashes and mod errors.",
    author: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    publisher: {
      "@type": "Organization",
      name: "FixMyGame",
    },
    mainEntityOfPage:
      "https://fixmygame-site.vercel.app/guides/lethal-company-bepinex-logoutput-fix",
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
            Lethal Company
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
            Lethal Company BepInEx LogOutput Fix
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/72">
            If Lethal Company crashes or your mods fail to load, the most useful
            file is usually{" "}
            <span className="text-cyan-200">BepInEx/LogOutput.log</span>. This
            guide helps you find the correct log and avoid uploading files that
            only list the modpack, like{" "}
            <span className="text-cyan-200">manifest.json</span>.
          </p>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Quick answer</h2>

            <p className="mt-3 leading-7 text-white/70">
              Launch Lethal Company until the issue happens, then open the
              newest <span className="text-cyan-200">BepInEx/LogOutput.log</span>{" "}
              file. Use that file in FixMyGame instead of manifest.json,
              profile files, or dependency lists.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">What LogOutput.log is</h2>

            <p className="mt-3 leading-7 text-white/75">
              LogOutput.log is the main BepInEx runtime log. It records what
              plugins loaded, which dependencies were missing, which errors
              happened during startup, and whether a mod failed while Lethal
              Company was opening.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-2xl font-bold">Common signs in the log</h2>

            <div className="mt-4 grid gap-3">
              {[
                "BepInEx",
                "LogOutput.log",
                "FileNotFoundException",
                "Could not load file or assembly",
                "Missing dependency",
                "Plugin failed to load",
                "Network prefab hash mismatch",
                "LC_API, BepInExPack, LateCompany, or MoreCompany",
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
            <h2 className="text-2xl font-bold">How to get the right log</h2>

            <div className="mt-5 space-y-3">
              {[
                "Open your Lethal Company modded profile or launcher.",
                "Launch the game and recreate the crash, failed load, or multiplayer issue.",
                "Close the game after the issue happens.",
                "Open the Lethal Company game folder or mod manager profile folder.",
                "Open the BepInEx folder.",
                "Open LogOutput.log.",
                "Use that newest LogOutput.log file in FixMyGame.",
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
            <h2 className="text-2xl font-bold">Do not upload manifest.json</h2>

            <p className="mt-3 leading-7 text-white/70">
              A manifest.json file usually lists the modpack name, version, and
              dependency list. That can be useful for seeing what the modpack
              contains, but it usually does not show the actual crash or plugin
              failure.
            </p>

            <div className="mt-4 grid gap-3">
              {[
                "manifest.json lists dependencies, but it is not the runtime crash log.",
                "profile files may show what should be installed, not what actually failed.",
                "LogOutput.log shows what BepInEx tried to load during the real session.",
                "If FixMyGame says manifest uploaded, run the game and use LogOutput.log instead.",
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
            <h2 className="text-2xl font-bold">
              Common Lethal Company mod issues
            </h2>

            <div className="mt-4 grid gap-3">
              {[
                "A required dependency is missing or outdated.",
                "BepInExPack is missing, broken, or installed in the wrong place.",
                "LC_API or another library is required by a mod.",
                "Multiplayer players do not have the same modpack/profile.",
                "A mod was built for a different Lethal Company version.",
                "A plugin failed while BepInEx was loading the game.",
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
                "Do not delete random plugins before checking the first BepInEx error.",
                "Do not upload manifest.json if FixMyGame asks for the crash log.",
                "Do not assume multiplayer issues are fixed if only your profile changed.",
                "Do not mix old and new dependency versions without retesting.",
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
              If FixMyGame says the file is a manifest or dependency list, run
              Lethal Company again, recreate the issue, and use the newest{" "}
              <span className="text-cyan-200">BepInEx/LogOutput.log</span>{" "}
              created after that session.
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
                  Learn why the newest log matters when diagnosing a modded game
                  crash.
                </p>
              </Link>

              <Link
                href="/guides/how-to-read-a-crash-log"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">How to Read a Crash Log</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn how to find the real error inside a long crash log.
                </p>
              </Link>

              <Link
                href="/guides/missing-dependencies"
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.055]"
              >
                <h3 className="font-semibold">Missing Dependencies</h3>
                <p className="mt-2 text-sm text-white/65">
                  Learn what it means when a mod needs another dependency before
                  it can load.
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
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}