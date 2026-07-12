import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FixMyGame | Crash Log Help for Modded PC Games",
  description:
    "FixMyGame helps diagnose modded PC game crashes, missing dependencies, mod conflicts, loader errors, and broken crash logs with clearer next steps.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FixMyGame",
    description:
      "Crash log diagnostics and guided troubleshooting for modded PC games.",
    url: "/",
    siteName: "FixMyGame",
    type: "website",
  },
};
export default function FixMyGameWebsite() {
    const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FixMyGame",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Windows",
    description:
      "FixMyGame helps diagnose crash logs, missing dependencies, mod conflicts, loader errors, and modded PC game crashes.",
    url: "https://fixmygame-site.vercel.app",
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/LimitedAvailability",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const supportedGames = [
    "Minecraft",
    "The Sims 4",
    "Skyrim Special Edition",
    "Fallout 4",
    "Stardew Valley",
    "Cyberpunk 2077",
    "Baldur's Gate 3",
    "Project Zomboid",
    "Stellaris",
    "+ More coming",
  ];

  const whatFixMyGameDoes = [
    {
      title: "Find the issue",
      description: "Detect mod conflicts and broken logs instantly",
    },
    {
      title: "See the fix",
      description: "Clear next steps, not technical noise",
    },
    {
      title: "Fix it faster",
      description: "Get back in game without trial and error",
    },
    {
      title: "Keep it working",
      description: "Continue diagnostics and track what worked",
    },
  ];

  const steps = [
    {
      title: "Load your log",
      description: "Paste a crash log or use supported auto-detect options.",
    },
    {
      title: "We find the issue",
      description:
        "FixMyGame highlights likely causes, broken mods, and missing dependencies.",
    },
    {
      title: "Apply the fix",
      description:
        "Use guided steps or supported Safe Fix actions when available.",
    },
    {
      title: "Get back in game",
      description:
        "Retest, continue diagnostics, or undo supported fixes if needed.",
    },
  ];

  const faqs = [
    {
      q: "Is FixMyGame a web app or desktop app?",
      a: "FixMyGame is a desktop app. This site is the public website where users learn about it and download builds.",
    },
    {
      q: "Does it work only for Minecraft?",
      a: "No. Minecraft is a major focus, but FixMyGame is being built for multiple modded PC games and will keep expanding.",
    },
    {
      q: "Can it fix things automatically?",
      a: "Some safe helper actions already exist, and the long-term vision is guided, permission-based automatic repair with backups and rollback.",
    },
    {
      q: "Do I need to understand crash logs?",
      a: "No. The goal is to turn confusing logs into clear explanations and practical next steps.",
    },
  ];

  const betaRequestUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLScGcdRTg2kv4-_NKk1x2MkjSd1QsVItjKxi0ht--HNf1GLngQ/viewform?usp=publish-editor";
  const betaTermsUrl =
    "https://www.notion.so/fixmygame/FixMyGame-Beta-Agreement-341948d92478803ab0b3c93d13335e58?source=copy_link";
  const privacyUrl =
    "https://www.notion.so/fixmygame/FixMyGame-Privacy-Policy-348948d9247880b4b896c729d957235e?source=copy_link";
  const supportUrl = "mailto:fixmygame.support@gmail.com";
  const termsUrl =
    "https://www.notion.so/fixmygame/FixMyGame-Terms-of-Service-348948d924788019abe8cb5e79581c76?source=copy_link";
  const donationUrl = "https://ko-fi.com/fixmygame";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
            <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
<div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_52%_78%,rgba(59,130,246,0.12),transparent_34%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 md:px-10">
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div>
            <div className="text-lg font-semibold tracking-tight">
              FixMyGame
            </div>
            <div className="text-xs text-white/55">
              AI crash diagnostics for modded PC games
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-white/75 md:flex">
            <a href="#core-features" className="hover:text-white">
              Core Features
            </a>
            <a href="#supported" className="hover:text-white">
              Supported Games
            </a>
            <a href="#how" className="hover:text-white">
              How It Works
            </a>
            <a href="#faq" className="hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={betaRequestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Request Beta Access
            </a>
          </div>
        </header>

        <main className="flex-1">
          <section className="grid items-center gap-10 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Find the issue → fix it faster
              </div>

              <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
                Stop guessing.
                <span className="block text-cyan-300">
                  Fix your modded game faster.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                FixMyGame reads crash logs, finds what likely went wrong, shows
                the next move, and helps users get back into the game faster.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={betaRequestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Request Beta Access
                </a>
              </div>

              <p className="mt-4 text-sm text-white/50">
                Windows desktop app for modded PC games.
              </p>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-bold text-cyan-300">Find</div>
                  <div className="mt-1 text-sm text-white/60">
                    Spot likely mod and log issues fast
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-bold text-violet-300">Fix</div>
                  <div className="mt-1 text-sm text-white/60">
                    Clear next steps that feel usable
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-bold text-emerald-300">
                    Play
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    Get back in game with less guessing
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-400/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur">
              <div className="rounded-[24px] border border-white/10 bg-[#071122] p-5">
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.2em] text-cyan-200/80">
                      FIXMYGAME
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      Diagnostic Preview
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                    Healthy log example
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4">
                    <div className="text-xs font-semibold tracking-widest text-cyan-100/80">
                      LIVE DETECTION
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                        Status: No clear issue
                      </span>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                        Session: Normal log
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                        Mods loaded
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs font-semibold tracking-widest text-white/55">
                      SMART FIX PATH
                    </div>
                    <div className="mt-2 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 py-3 text-lg font-semibold text-white">
                      No clear issue found in this log
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-white/75">
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        This log looks normal and does not show an active crash
                        or broken mod.
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        Launch the game again and test normally.
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        If the issue returns, load the newest crash or error log
                        created after it happens.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs font-semibold tracking-widest text-white/55">
                      DIAGNOSTIC RESULT
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs font-semibold tracking-widest text-white/50">
                          ISSUE
                        </div>
                        <div className="mt-2 text-sm text-white/85">
                          No clear crash, broken mod, or missing dependency was
                          found.
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs font-semibold tracking-widest text-white/50">
                          CONFIDENCE
                        </div>
                        <div className="mt-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                          High
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs font-semibold tracking-widest text-white/55">
                      FIX HISTORY
                    </div>
                    <div className="mt-3 grid gap-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/80">
                        Stardew Valley diagnostic run
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/80">
                        Continue from previous result
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="core-features" className="py-8 md:py-14">
            <div className="mb-6">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                Core Features
              </div>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                No more guessing what broke your game
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {whatFixMyGameDoes.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur"
                >
                  <div className="text-lg font-semibold">{feature.title}</div>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="py-8 md:py-14">
            <div className="mb-6">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                What it actually fixes
              </div>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                Real problems FixMyGame detects
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Missing or broken mods",
                "Mod conflicts crashing your game",
                "Wrong mod loader or version mismatch",
                "Dependency errors (mods needing other mods)",
                "Game launches but nothing works correctly",
                "Random crashes with no clear error",
                "Graphics / driver-related crashes",
                "Mods causing lag or instability",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section id="supported" className="py-8 md:py-14">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200/70">
                Supported Games
              </div>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                Growing multi-game support
              </h2>
              <p className="mt-3 max-w-2xl text-white/68">
                Works with real modded setups — not just clean installs.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                {supportedGames.map((game) => (
                  <span
                    key={game}
                    className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white/85"
                  >
                    {game}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section id="how" className="py-8 md:py-14">
            <div className="mx-auto max-w-6xl px-6">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                How It Works
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 font-bold text-slate-950">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-lg font-semibold">
                          {step.title}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-white/68">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="beta" className="py-8 md:py-14">
            <div className="rounded-[28px] border border-white/10 bg-cyan-400/10 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Private beta
              </div>
              <h3 className="mt-2 text-2xl font-bold md:text-3xl">
                Request beta access
              </h3>
              <p className="mt-3 max-w-2xl text-white/72">
                FixMyGame is currently in private Windows beta. Access is
                approved manually, so only invited testers can download and try
                builds during this phase.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={betaRequestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Request Beta Access
                </a>
              </div>

              <div className="mt-4 space-y-2 text-sm text-white/55">
                <p>
                  By requesting access, you agree to the{" "}
                  <a
                    href={betaTermsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 hover:text-cyan-200"
                  >
                    Beta Agreement
                  </a>
                  ,{" "}
                  <a
                    href={termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 hover:text-cyan-200"
                  >
                    Terms of Service
                  </a>
                  , and{" "}
                  <a
                    href={privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 hover:text-cyan-200"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>

                <p className="text-sm text-cyan-300/80">
                  Approved testers who actively provide useful feedback during
                  beta will receive a discounted Pro subscription for life on
                  the email they used to join beta.
                </p>
              </div>
            </div>
          </section>

                    <section id="support-fixmygame" className="py-8 md:py-14">
            <div className="rounded-[28px] border border-cyan-400/20 bg-white/5 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Optional support
              </div>

              <h3 className="mt-2 text-2xl font-bold md:text-3xl">
                Support FixMyGame
              </h3>

              <p className="mt-3 max-w-2xl text-white/72">
                FixMyGame beta is free to test. If the app helped you or you
                want to support continued development, optional donations help
                cover hosting, testing, bug review, and future app updates.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={donationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  Support FixMyGame
                </a>
              </div>

              <p className="mt-4 text-sm text-white/50">
                Donations are optional and are not required for beta access.
              </p>
            </div>
          </section>
          <section id="faq" className="py-8 md:py-14">
            <div className="mb-6">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-200/70">
                FAQ
              </div>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                Questions users will ask
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                >
                  <div className="text-lg font-semibold">{faq.q}</div>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/55">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-white/85">FixMyGame</div>
              <div>AI crash diagnostics for modded PC games.</div>
            </div>
            <div className="flex flex-wrap gap-4">
              <a href="#beta" className="hover:text-white">
                Download
              </a>
              <a href="/guides" className="hover:text-white">
                Guides
              </a>
              <a href={supportUrl} className="hover:text-white">
                Support
              </a>
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                Privacy
              </a>
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                Terms
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
