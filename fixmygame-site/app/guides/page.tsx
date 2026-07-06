import Link from "next/link";

export const metadata = {
  title: "FixMyGame Guides | Crash Log Help for Modded PC Games",
  description:
    "Beginner-friendly FixMyGame guides for Minecraft crash errors, Java version issues, missing dependencies, SMAPI logs, BepInEx logs, mod conflicts, and safe repair previews.",
};
const guideSections = [
  {
    title: "Start Here",
    description: "Basic FixMyGame and crash-log help before you start changing files.",
    guides: [
      {
        title: "How to read a crash log",
        description:
          "Learn what parts of a crash log actually matter and what can usually be ignored.",
        tag: "Beginner",
        href: "/guides/how-to-read-a-crash-log",
      },
      {
        title: "Fresh log vs old log",
        description:
          "Why FixMyGame needs the newest log after a crash, not an older healthy session.",
        tag: "Important",
        href: "/guides/fresh-log-vs-old-log",
      },
    ],
  },
  {
    title: "Crash Fix Library",
    description: "Specific crash messages and common modded-game errors.",
    guides: [
      {
        title: "Minecraft JEI ClassNotFoundException Fix",
        description:
          "Fix crashes mentioning mezz.jei.api.runtime.IJeiRuntime or missing JEI classes.",
        tag: "Minecraft",
        href: "/guides/minecraft-jei-classnotfoundexception-fix",
      },
      {
        title: "Minecraft Java 17 UnsupportedClassVersionError Fix",
        description:
          "Fix Minecraft crashes caused by running the wrong Java version for your modpack.",
        tag: "Minecraft",
        href: "/guides/minecraft-unsupportedclassversionerror-java-17-fix",
      },
      {
        title: "Minecraft Fabric API Missing Dependency Fix",
        description:
          "What to do when a Fabric mod needs Fabric API before it can load.",
        tag: "Minecraft",
        href: "/guides/minecraft-fabric-api-missing-dependency-fix",
      },
      {
        title: "Stardew Valley SMAPI Empty Folder Fix",
        description:
          "Clean up SMAPI skipped-mod warnings caused by empty or invalid mod folders.",
        tag: "Stardew Valley",
        href: "/guides/stardew-smapi-empty-folder-skipped-mod-fix",
      },
      {
        title: "Lethal Company BepInEx LogOutput Fix",
        description:
          "Find the right BepInEx log and understand missing dependency issues.",
        tag: "Lethal Company",
        href: "/guides/lethal-company-bepinex-logoutput-fix",
      },
    ],
  },
  {
    title: "FixMyGame Help",
    description: "General troubleshooting concepts FixMyGame uses when reading logs.",
    guides: [
      {
        title: "Missing dependencies",
        description:
          "What it means when a mod needs another mod installed before it can work.",
        tag: "Mods",
        href: "/guides/missing-dependencies",
      },
      {
        title: "Mod conflicts",
        description:
          "How two mods can break each other and why removing one is sometimes the fix.",
        tag: "Troubleshooting",
        href: "/guides/mod-conflicts",
      },
      {
        title: "Safe Repair Preview",
        description:
          "What FixMyGame can safely help with and why backups matter before changes.",
        tag: "FixMyGame",
        href: "/guides/safe-repair-preview",
      },
      {
        title: "When to reinstall or verify files",
        description:
          "Know when the issue is probably game files instead of your mods.",
        tag: "Game Files",
        href: "/guides/verify-or-reinstall-game-files",
      },
    ],
  },
];

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.12),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 md:px-10">
          <div className="pt-2">
  <Link
    href="/"
    className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-cyan-100"
  >
    ← FixMyGame Home
  </Link>
</div>

        <main className="flex-1">
          <section className="py-12 md:py-7">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                FixMyGame Guides
              </div>

              <h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">
                Learn what broke.
                <span className="block text-cyan-300">
                  Fix it with less guessing.
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                Simple guides for crash logs, mod conflicts, missing
                dependencies, and safer troubleshooting before you start
                deleting files.
              </p>
            </div>

            <div className="mt-12 space-y-12">
  {guideSections.map((section) => (
    <section key={section.title}>
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
          {section.title}
        </div>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
          {section.description}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {section.guides.map((guide) => (
          <article
            key={guide.title}
            className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-cyan-400/30 hover:bg-white/[0.07]"
          >
            <div className="mb-4 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
              {guide.tag}
            </div>

            <h2 className="text-xl font-semibold">{guide.title}</h2>

            <p className="mt-3 text-sm leading-6 text-white/68">
              {guide.description}
            </p>

            <div className="mt-5 text-sm font-semibold text-cyan-300">
              <Link href={guide.href}>Open guide →</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  ))}
</div>
          </section>

          <section className="py-8 md:py-14">
            <div className="rounded-[28px] border border-white/10 bg-cyan-400/10 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Start here
              </div>

              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                Not sure which guide you need?
              </h2>

              <p className="mt-3 max-w-2xl text-white/72">
                If your game crashed, open the newest crash or error log created
                after the problem happened. Old logs can look healthy even when
                the newest session is broken.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-lg font-bold text-cyan-300">1</div>
                  <div className="mt-2 text-sm text-white/75">
                    Recreate the crash or issue.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-lg font-bold text-violet-300">2</div>
                  <div className="mt-2 text-sm text-white/75">
                    Find the newest log file.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-lg font-bold text-emerald-300">3</div>
                  <div className="mt-2 text-sm text-white/75">
                    Run it through FixMyGame.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
