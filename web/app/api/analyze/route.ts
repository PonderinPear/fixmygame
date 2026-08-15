import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { isProUser } from "@/lib/pro";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-fmg-device-id, x-fmg-app-version, x-fmg-build-channel",
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DAILY_LIMIT = 3;

const MIN_SUPPORTED_BETA_VERSION = "1.0.9";

function parseAppVersion(version: string) {
  return String(version || "")
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number(part.replace(/[^0-9]/g, "")) || 0)
    .slice(0, 3);
}

function isVersionBelow(currentVersion: string, minimumVersion: string) {
  const current = parseAppVersion(currentVersion);
  const minimum = parseAppVersion(minimumVersion);

  for (let i = 0; i < 3; i++) {
    const currentPart = current[i] || 0;
    const minimumPart = minimum[i] || 0;

    if (currentPart < minimumPart) return true;
    if (currentPart > minimumPart) return false;
  }

  return false;
}

type DetectedSignals = {
  errorType?: string;
  loader?: string;
  launcher?: string;
  gameVersion?: string;
  javaVersion?: string;
  suspectedMods: string[];
  likelyCategory?:
    | "mod_conflict"
    | "missing_dependency"
    | "dependency_not_initialized"
    | "loader_mismatch"
    | "mixin_failure"
    | "gpu_driver_issue"
    | "out_of_memory"
    | "shader_crash"
    | "java_mismatch"
    | "runtime_disconnect"
    | "network_mod_failure"
    | "game_files_corrupt"
    | "no_clear_issue_found"
    | "no_new_log"
    | "advisory_skipped_mod"
    | "advisory_empty_folder"
    | "advisory_optional_dependency"
    | "advisory_workshop_warning"
    | "advisory_partial_load"
    | "unknown";
  dependencyState?:
    | "missing_not_installed"
    | "installed_but_not_loaded"
    | "installed_but_wrong_version"
    | "installed_but_corrupted"
    | "unknown_dependency_state";
  missingComponentRaw?: string;
  missingComponentDisplay?: string;
  recommendedAction?:
    | "install"
    | "relaunch"
    | "update_or_match_version"
    | "reinstall"
    | "inspect";
};

type AnalyzeModelResponse = {
  quickFixFirst: string;
  issue: string;
  confidenceLevel: "Low" | "Medium" | "High";
  probabilityBreakdown: string[];
  mostLikelyCause: string;
  recommendedFixSteps: string[];
  needMoreInfo: string;

  explanation?: {
    whatThisMeans: string;
    whyFixMyGameThinksThis: string[];
    beginnerExplanation: string;
    doNotDoYet: string[];
    stillCrashingNextSteps: string[];
  };

  detectedSignals: DetectedSignals;
};

type EvidenceStrength = "weak" | "moderate" | "strong";

type CrashEvidence = {
  exceptionType: string;
  accessViolation: boolean;

  probableCallStack: string;
  stackDlls: string[];
  thirdPartyStackDlls: string[];

  nativePluginInventoryPresent: boolean;

  explicitFailureEvidence: boolean;
  explicitRuntimeMismatch: boolean;
  explicitMissingDependency: boolean;

  evidenceStrength: EvidenceStrength;
};

type EvidencePolicy = {
  maxConfidence: "Low" | "Medium" | "High";
  allowNamedCulprit: boolean;
  allowAutomaticRepair: boolean;
  evidenceReason: string;
};

function extractCrashEvidence(crashLog: string): CrashEvidence {
  const log = String(crashLog || "");
  const lower = log.toLowerCase();

  const probableCallStackMatch = log.match(
    /PROBABLE CALL STACK:\s*([\s\S]*?)(?:\n\s*[A-Z0-9][A-Z0-9 _-]+:|\s*$)/i,
  );

  const probableCallStack = probableCallStackMatch?.[1] || "";

  const stackDlls = Array.from(
    probableCallStack.matchAll(/([A-Za-z0-9_.-]+\.dll)/gi),
  ).map((match) => match[1].toLowerCase());

  const ignoredSystemDlls = new Set([
    "kernel32.dll",
    "kernelbase.dll",
    "ntdll.dll",
    "user32.dll",
    "win32u.dll",
    "ucrtbase.dll",
    "vcruntime140.dll",
    "msvcp140.dll",
  ]);

  const thirdPartyStackDlls = stackDlls.filter(
    (dll) => !ignoredSystemDlls.has(dll),
  );

  const exceptionMatch =
    log.match(
      /(?:Unhandled exception\s+"?([^"\r\n]+)"?|([A-Za-z0-9_.]+Exception|[A-Za-z0-9_.]+Error))/i,
    );

  const exceptionType =
    String(exceptionMatch?.[1] || exceptionMatch?.[2] || "").trim();

  const accessViolation =
    lower.includes("exception_access_violation") ||
    lower.includes("access violation");

  const nativePluginInventoryPresent =
    /(?:(?:SKSE|F4SE|SFSE)\s+PLUGINS|SCRIPT EXTENDER PLUGINS):/i.test(log);

  const explicitRuntimeMismatch =
    /reported as incompatible|unsupported runtime|version mismatch|expected runtime|requires .* version/i.test(
      log,
    );

  const explicitMissingDependency =
    /missing dependency|missing mods|classnotfoundexception|noclassdeffounderror|could not find .* dependency|requires .* dependency/i.test(
      log,
    );

  const explicitFailureEvidence =
    /failed to load|could not load|fatal error.*(?:plugin|mod|dll)/i.test(log) ||
    explicitRuntimeMismatch ||
    explicitMissingDependency;

  let evidenceStrength: EvidenceStrength = "weak";

  if (explicitFailureEvidence) {
    evidenceStrength = "strong";
  } else if (thirdPartyStackDlls.length > 0) {
    evidenceStrength = "moderate";
  } else if (accessViolation || nativePluginInventoryPresent || exceptionType) {
    evidenceStrength = "weak";
  }

  return {
    exceptionType,
    accessViolation,

    probableCallStack,
    stackDlls,
    thirdPartyStackDlls,

    nativePluginInventoryPresent,

    explicitFailureEvidence,
    explicitRuntimeMismatch,
    explicitMissingDependency,

    evidenceStrength,
  };
}

function buildEvidencePolicy(evidence: CrashEvidence): EvidencePolicy {
  if (
    evidence.nativePluginInventoryPresent &&
    evidence.accessViolation &&
    evidence.thirdPartyStackDlls.length === 0 &&
    !evidence.explicitFailureEvidence
  ) {
    return {
      maxConfidence: "Medium",
      allowNamedCulprit: false,
      allowAutomaticRepair: false,
      evidenceReason:
        "The crash shows native plugins were loaded, but no third-party plugin is identified in the probable call stack and no explicit incompatibility or load failure is present.",
    };
  }

  if (evidence.explicitFailureEvidence) {
    return {
      maxConfidence: "High",
      allowNamedCulprit: true,
      allowAutomaticRepair: false,
      evidenceReason:
        "The log contains explicit failure, incompatibility, dependency, or runtime evidence.",
    };
  }

  if (evidence.thirdPartyStackDlls.length > 0) {
    return {
      maxConfidence: "High",
      allowNamedCulprit: true,
      allowAutomaticRepair: false,
      evidenceReason:
        "A third-party DLL appears in the probable call stack and can be investigated as a stronger suspect.",
    };
  }

  return {
    maxConfidence: "Medium",
    allowNamedCulprit: false,
    allowAutomaticRepair: false,
    evidenceReason:
      "The available log evidence does not strongly prove one individual culprit.",
  };
}

function buildLikelihoodBreakdown(
  entries: Array<{
    label: string;
    strength: "most_likely" | "possible" | "less_likely";
  }>,
): string[] {
  return entries.map(({ label, strength }) => {
    if (strength === "most_likely") {
      return `Most likely - ${label}`;
    }

    if (strength === "possible") {
      return `Possible - ${label}`;
    }

    return `Less likely - ${label}`;
  });
}

function isDeterministicResult(
  analysis: AnalyzeModelResponse,
): boolean {
  const category = analysis.detectedSignals?.likelyCategory;

  return (
    category === "no_new_log" ||
    category === "no_clear_issue_found" ||
    category === "advisory_empty_folder" ||
    category === "game_files_corrupt"
  );
}

function capConfidenceLevel(
  confidence: AnalyzeModelResponse["confidenceLevel"],
  maximum: EvidencePolicy["maxConfidence"],
): AnalyzeModelResponse["confidenceLevel"] {
  const rank = {
    Low: 1,
    Medium: 2,
    High: 3,
  } as const;

  return rank[confidence] > rank[maximum]
    ? maximum
    : confidence;
}

function enforceEvidencePolicy(
  analysis: AnalyzeModelResponse,
  policy: EvidencePolicy,
): AnalyzeModelResponse {
    if (isDeterministicResult(analysis)) {
    return analysis;
  }
  const saferConfidence = capConfidenceLevel(
  analysis.confidenceLevel,
  policy.maxConfidence,
);

const exceedsConfidence =
  saferConfidence !== analysis.confidenceLevel;
  const shouldSuppressNamedCulprit = !policy.allowNamedCulprit;

  if (!exceedsConfidence && !shouldSuppressNamedCulprit) {
    return analysis;
  }

  if (!shouldSuppressNamedCulprit) {
    return {
      ...analysis,
      confidenceLevel: saferConfidence,
    };
  }

  return {
    ...analysis,

    quickFixFirst:
      "Check version compatibility, dependencies, and recently changed mods/plugins before removing any individual component.",

    issue:
      "The log shows a real failure, but the available evidence does not safely identify one individual mod or plugin as the confirmed cause.",

    confidenceLevel: saferConfidence,

    probabilityBreakdown: [
      "Most likely - Compatibility, dependency, or plugin interaction issue",
      "Possible - Conflict involving one or more loaded mods/plugins",
      "Possible - Game, runtime, driver, or environment issue",
    ],

    mostLikelyCause:
      "The crash evidence supports investigating the mod/plugin environment, but it does not prove that one specific loaded component caused the failure.",

    recommendedFixSteps: [
      "Check that the game, loader or script extender, frameworks, and native plugins all use compatible versions.",
      "Check recently installed or recently updated mods/plugins first.",
      "Use explicit failure lines, dependency errors, or relevant call-stack entries to narrow the suspect list.",
      "If the log does not identify one culprit, test recent changes one at a time instead of removing an arbitrary listed plugin.",
      "Run FixMyGame again with the newest log after each controlled test.",
    ],

    needMoreInfo:
      "A newer log with an explicit load failure, dependency error, runtime mismatch, or relevant third-party call-stack entry can support identifying an individual culprit.",

    explanation: {
      whatThisMeans:
        "FixMyGame found evidence of a real problem, but this log is not specific enough to safely blame one individual mod or plugin.",

      whyFixMyGameThinksThis: [
        policy.evidenceReason,
        "Loaded-plugin lists and general module inventories show what was present, not necessarily what caused the crash.",
        "FixMyGame did not find enough direct causal evidence to safely isolate one component.",
      ],

      beginnerExplanation:
        "A crash log can list many mods and plugins simply because they were loaded. Seeing a name in the report does not automatically mean that item caused the crash.",

      doNotDoYet: [
        "Do not delete or quarantine a specific mod only because its name appears somewhere in the log.",
        "Do not remove your entire mod setup.",
        "Do not reinstall the whole game before checking the more targeted compatibility and error evidence.",
      ],

      stillCrashingNextSteps: [
        "Reproduce the problem and use the newest crash log.",
        "Check version compatibility and explicit error lines first.",
        "Test recently changed mods/plugins one at a time if the log still cannot isolate a culprit.",
        "Run another diagnostic after each controlled change.",
      ],
    },

    detectedSignals: {
      ...analysis.detectedSignals,
      suspectedMods: [],
      likelyCategory:
        analysis.detectedSignals?.likelyCategory === "mod_conflict"
          ? "unknown"
          : analysis.detectedSignals?.likelyCategory || "unknown",
    },
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getClientKey(req: NextRequest) {
  const headerVid = req.headers.get("x-fmg-device-id")?.trim();
  if (headerVid) return `vid:${headerVid}`;

  const cookieVid = req.cookies.get("vid")?.value;
  if (cookieVid) return `vid:${cookieVid}`;

  const xff = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = (xff?.split(",")[0] || realIp || "").trim();

  if (ip) return `ip:${ip}`;
  return `unknown:${crypto.randomUUID()}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.error(`${label} timed out after ${ms}ms`);
        resolve(fallback);
      }, ms),
    ),
  ]);
}

async function getRemaining(req: NextRequest) {
  const cookiePro = req.cookies.get("fmg_pro")?.value === "1";

  const redisPro = await withTimeout(
    isProUser(req),
    1500,
    false,
    "Redis pro check in getRemaining",
  );

  const isPro = redisPro || cookiePro;
  if (isPro) return { isPro: true, remaining: 999, limit: 999, isBeta: true };

  try {
    const clientKey = getClientKey(req);
    const key = `limit:${today()}:${clientKey}`;

    const redis = await getRedis();
    const currentRaw = await withTimeout(
  redis.get(key),
  1500,
  null,
  "Redis remaining check",
);

    const current = currentRaw ? Number(currentRaw) : 0;
    const remaining = Math.max(0, DAILY_LIMIT - current);

    return { isPro: false, remaining, limit: DAILY_LIMIT, isBeta: false };
  } catch (error) {
    console.error("getRemaining failed open:", error);
    return { isPro: false, remaining: 999, limit: 999, isBeta: true };
  }
}

async function incrementAndGetCount(req: NextRequest) {
  try {
    const clientKey = getClientKey(req);
    const key = `limit:${today()}:${clientKey}`;

    const redis = await getRedis();
    const count = await withTimeout(
      redis.incr(key),
      1500,
      0,
      "Redis increment limit check",
    );

    if (count === 1) {
      await withTimeout(
        redis.expire(key, 60 * 60 * 48),
        1500,
        0,
        "Redis expire limit key",
      );
    }

    return count;
  } catch (error) {
    console.error("incrementAndGetCount failed open:", error);
    return 0;
  }
}

function getRelevantLogWindow(crashLog: string, gameKey = "") {
  const sessions = splitLogIntoSessions(crashLog, gameKey);

  if (!sessions.length) {
    return String(crashLog || "").split("\n").slice(-160).join("\n");
  }

  const scored = sessions.map((session, index) => ({
    ...session,
    sessionIndex: index,
    score: scoreLogSession(session.text, gameKey),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.sessionIndex - a.sessionIndex;
  });

  const best = scored[0];

  if (!best?.text) {
    return String(crashLog || "").split("\n").slice(-160).join("\n");
  }

  return best.text;
}

function splitLogIntoSessions(crashLog: string, gameKey = "") {
  const lines = String(crashLog || "").split("\n");
  if (!lines.length) return [];

  const sessionStarts: number[] = [0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    const isTimestampedRestart =
      /^\[\d{1,2}:\d{2}:\d{2}\]/.test(lines[i]) &&
      (
        line.includes("loading minecraft") ||
        line.includes("starting jei") ||
        line.includes("smapi") ||
        line.includes("log started at") ||
        line.includes("game version") ||
        line.includes("initializing")
      );

    const isExplicitSessionStart =
      line.includes("smapi 4.") ||
      line.includes("log started at") ||
      line.includes("loading minecraft") ||
      line.includes("launcher bootstrap") ||
      line.includes("main/info") && line.includes("loading") ||
      line.includes("starting game") ||
      line.includes("game started");

    if ((isTimestampedRestart || isExplicitSessionStart) && i > 0) {
      sessionStarts.push(i);
    }
  }

  const dedupedStarts = Array.from(new Set(sessionStarts)).sort((a, b) => a - b);

  const sessions = dedupedStarts.map((start, index) => {
    const end =
      index < dedupedStarts.length - 1
        ? dedupedStarts[index + 1]
        : lines.length;

    const sessionLines = lines.slice(start, end);
    const text = sessionLines.join("\n").trim();

    return {
      start,
      end,
      text,
      lineCount: sessionLines.length,
    };
  });

  return sessions.filter((s) => s.text.length > 0);
}

function scoreLogSession(sessionText: string, gameKey = "") {
  const lower = String(sessionText || "").toLowerCase();
  let score = 0;

  // Strong crash / failure signals
  if (lower.includes("classnotfoundexception")) score += 120;
  if (lower.includes("noclassdeffounderror")) score += 120;
  if (lower.includes("missing dependency")) score += 110;
  if (lower.includes("missing mods")) score += 110;
  if (lower.includes("mixin")) score += 100;
  if (lower.includes("failed to load")) score += 100;
  if (lower.includes("could not load")) score += 90;
  if (lower.includes("exception")) score += 80;
  if (lower.includes("error")) score += 70;
  if (lower.includes("crash")) score += 80;
  if (lower.includes("fatal")) score += 90;
  if (lower.includes("traceback")) score += 90;
  if (lower.includes("timed out")) score += 75;
  if (lower.includes("readtimeoutexception")) score += 85;

  // Advisory / warning-only signals
  if (lower.includes("skipped mods")) score += 50;
  if (lower.includes("empty folder")) score += 50;
  if (lower.includes("warning")) score += 20;

  // Healthy / normal signals reduce score
  if (lower.includes("mods loaded and ready!")) score -= 60;
  if (lower.includes("no clear issue")) score -= 30;
  if (lower.includes("closedgame")) score -= 25;

  // Game-specific weighting
  if (gameKey === "minecraft") {
    if (lower.includes("loading minecraft")) score += 10;
    if (lower.includes("fabric")) score += 5;
    if (lower.includes("forge")) score += 5;
  }

  if (gameKey === "stardew_valley") {
    if (lower.includes("smapi")) score += 10;
  }

  if (gameKey === "project_zomboid") {
    if (lower.includes("lua")) score += 10;
    if (lower.includes("workshop")) score += 10;
  }

  return score;
}

function buildSessionFingerprint(text: string) {
  return normalizeLogForComparison(text)
    .slice(0, 4000);
}

function isHealthyLog(crashLog: string, gameKey = "") {
  const lower = crashLog.toLowerCase();

  const hasStrongCrashSignal =
    lower.includes("exception:") ||
    lower.includes("fatal") ||
    lower.includes("stack trace") ||
    lower.includes("stacktrace") ||
    lower.includes("missing dependency") ||
    lower.includes("classnotfoundexception") ||
    lower.includes("nosuchmethoderror") ||
    lower.includes("outofmemoryerror") ||
    lower.includes("unsupportedclassversionerror") ||
    lower.includes("invalidinjectionexception") ||
    lower.includes("failed to load") ||
    lower.includes("could not load") ||
    lower.includes("mods could not be added") ||
    lower.includes("skipped mods") ||
    lower.includes("missing mods") ||
    lower.includes("mixin apply failed") ||
    lower.includes("loader mismatch");

  if (hasStrongCrashSignal) {
    return false;
  }

  // Stardew Valley / SMAPI
  if (gameKey === "stardew_valley") {
    const hasHealthySignals =
      lower.includes("mods loaded and ready!") ||
      lower.includes("smapi okay") ||
      lower.includes("launching mods...") ||
      lower.includes("loaded 1 mods") ||
      lower.includes("loaded 2 mods") ||
      lower.includes("loaded 3 mods") ||
      lower.includes("loaded 4 mods") ||
      lower.includes("loaded 5 mods") ||
      lower.includes("disconnected: closedgame") ||
      lower.includes("disposing the content coordinator") ||
      lower.includes("galaxy auth success") ||
      lower.includes("galaxy signed in") ||
      lower.includes("galaxy logged on");

    return hasHealthySignals;
  }

  // Minecraft
  if (gameKey === "minecraft") {
    const hasHealthySignals =
      (lower.includes("loaded") && lower.includes("mods")) ||
      lower.includes("game started") ||
      lower.includes("starting minecraft") ||
      lower.includes("minecraft started");

    const hasBadMinecraftSignals =
      lower.includes("error loading class") ||
      lower.includes("caused by:") ||
      lower.includes("mod resolution encountered an incompatible") ||
      lower.includes("failed to create mod instance");

    return hasHealthySignals && !hasBadMinecraftSignals;
  }

  // Sims 4
  if (gameKey === "sims4") {
    const hasBadSimsSignals =
      lower.includes("lastexception") ||
      lower.includes("lastuiexception") ||
      lower.includes("script call failed") ||
      lower.includes("xml injector") ||
      lower.includes("traceback");

    if (hasBadSimsSignals) return false;

    const hasHealthySignals =
      lower.includes("the sims 4") ||
      lower.includes("electronic arts") ||
      lower.includes("documents\\electronic arts\\the sims 4");

    return hasHealthySignals;
  }

  // Skyrim SE
  if (gameKey === "skyrimse") {
    const hasBadSkyrimSignals =
      lower.includes("skse plugin loader") ||
      lower.includes("address library") && lower.includes("failed") ||
      lower.includes("dll plugin") && lower.includes("failed") ||
      lower.includes("plugin") && lower.includes("error");

    if (hasBadSkyrimSignals) return false;

    const hasHealthySignals =
      lower.includes("skyrim special edition") ||
      lower.includes("skse") ||
      lower.includes("plugins loaded");

    return hasHealthySignals;
  }

  // Fallout 4
  if (gameKey === "fallout4") {
    const hasBadFalloutSignals =
      lower.includes("buffout") && lower.includes("crash") ||
      lower.includes("f4se") && lower.includes("error") ||
      lower.includes("plugin") && lower.includes("error");

    if (hasBadFalloutSignals) return false;

    const hasHealthySignals =
      lower.includes("fallout 4") ||
      lower.includes("fallout4") ||
      lower.includes("f4se");

    return hasHealthySignals;
  }

  // Conservative generic fallback for other games:
  // only mark healthy if there are no strong crash signals AND no obvious generic failure terms.
  const hasGenericFailureSignals =
    lower.includes(" exception ") ||
    lower.includes(" error ") ||
    lower.includes(" crashed ") ||
    lower.includes(" crash ") ||
    lower.includes(" failed ") ||
    lower.includes(" failure ");

  if (!hasGenericFailureSignals && crashLog.trim().split("\n").length >= 10) {
    return true;
  }

  return false;
}

function extractSuspectedMods(crashLog: string, gameKey = "") {
  const lower = crashLog.toLowerCase();
  const mods = new Set<string>();

  if (gameKey === "stardew_valley") {
    const lines = crashLog.split("\n");

    for (const line of lines) {
      const loadedMatch = line.match(
        /^\[[^\]]+\]\s+INFO\s+SMAPI\]\s+(.+?)\s+\d+\.\d+(?:\.\d+)*\s+by\s+/i
      );
      if (loadedMatch?.[1]) {
        const modName = loadedMatch[1].trim();
        if (
          modName &&
          !modName.toLowerCase().includes("type 'help'") &&
          !modName.toLowerCase().includes("mods go here")
        ) {
          mods.add(modName);
        }
      }

      const traceMatch = line.match(
        /^\[[^\]]+\]\s+TRACE\s+SMAPI\]\s+(.+?)\s+\(from\s+Mods\\/i
      );
      if (traceMatch?.[1]) {
        const modName = traceMatch[1].trim();
        if (modName) {
          mods.add(modName);
        }
      }
    }

    return Array.from(mods).slice(0, 20);
  }

  if (gameKey === "minecraft") {
    const knownMods = [
      "jei",
      "fabric-api",
      "sodium",
      "iris",
      "oculus",
      "optifine",
      "rubidium",
      "embeddium",
    ];

    for (const mod of knownMods) {
      if (lower.includes(mod)) {
        mods.add(mod);
      }
    }

    return Array.from(mods).slice(0, 20);
  }

  return [];
}

function buildContinuationAwareHealthyResult(params: {
  gameTitle: string;
  continuedDiagnostic?: {
    issue?: string;
    likelyCategory?: string;
    previousText?: string;
    suspectedMods?: string[];
    previousRelevantLog?: string;
  } | null;
  currentMods?: string[];
}) {
  const { gameTitle, continuedDiagnostic, currentMods = [] } = params;

  const previousCategory = continuedDiagnostic?.likelyCategory || "";
  const previousIssue = continuedDiagnostic?.issue || "";
  const previousWasHealthy = previousCategory === "no_clear_issue_found";

  const hasAdditionalMods = currentMods.length > 0;

  if (previousWasHealthy) {
    return {
      quickFixFirst: hasAdditionalMods
        ? `Your previous diagnostic also showed no clear issue, and this newer ${gameTitle} log still looks healthy with active mods loaded.`
        : `Your previous diagnostic also showed no clear issue, and this newer ${gameTitle} log still looks healthy.`,
      issue:
        "No clear crash, broken mod, or missing dependency was found. This result is consistent with the previous diagnostic.",
      confidenceLevel: "High" as const,
      probabilityBreakdown: [
        "100% - No clear issue found across both diagnostics",
      ],
      mostLikelyCause: hasAdditionalMods
        ? "The game appears stable across both diagnostics, including with currently loaded mods."
        : "The game appears stable across both diagnostics.",
      recommendedFixSteps: [
        `Launch ${gameTitle} normally and keep playing.`,
        "If a problem appears later, run another diagnostic immediately after it happens.",
        "Load the newest crash or error log from the moment the issue occurs if the problem returns.",
      ],
      needMoreInfo:
        "No additional information is needed unless the issue returns.",
      detectedSignals: {
        suspectedMods: currentMods,
        likelyCategory: "no_clear_issue_found" as const,
      },
    };
  }

  return {
    quickFixFirst:
      previousIssue.trim().length > 0
        ? `The previous issue is not visible in this newer ${gameTitle} log. The game now appears stable.`
        : `No clear issue was found in this newer ${gameTitle} log.`,
    issue:
      previousIssue.trim().length > 0
        ? `The previous issue does not appear in this newest log. No clear crash, broken mod, or missing dependency is currently visible.`
        : "No clear crash, broken mod, or missing dependency was found in this log.",
    confidenceLevel: "High" as const,
    probabilityBreakdown: [
      previousIssue.trim().length > 0
        ? "100% - Previous issue not visible in newest log"
        : "100% - No clear issue found in this log",
    ],
    mostLikelyCause:
      previousIssue.trim().length > 0
        ? "The game appears to be starting and closing normally, so the previous issue may be resolved."
        : "This log appears to show a normal startup or normal session end rather than an active crash or mod failure.",
    recommendedFixSteps: [
      `Launch ${gameTitle} again and test normally.`,
      "If the old issue returns, load the newest crash or error log created after it happens.",
      "If the problem is intermittent, run FixMyGame again immediately after it appears.",
    ],
    needMoreInfo:
      previousIssue.trim().length > 0
        ? "If the old problem returns, load the newest crash or error log from that exact run so FixMyGame can compare it against the previous issue."
        : "If your game is still crashing, this may be the wrong log or a normal session log. Load the newest crash or error log created after the problem appears.",
    detectedSignals: {
      suspectedMods: currentMods,
      likelyCategory: "no_clear_issue_found" as const,
    },
  };
}

function detectForcedStardewEmptyFolderAdvisory(params: {
  crashLog: string;
  quickSignals?: Record<string, unknown> | null;
  logHighlights?: string[] | null;
  liveMods?: string[] | null;
}) {
  const rawLog = String(params.crashLog || "");
  const lowerLog = rawLog.toLowerCase();

  const quickIssue = String(params.quickSignals?.issue || "").toLowerCase();
  const quickError = String(params.quickSignals?.error || "").toLowerCase();
  const highlights = Array.isArray(params.logHighlights) ? params.logHighlights : [];
  const mods = Array.isArray(params.liveMods) ? params.liveMods : [];

  const emptyFolderMatch =
    rawLog.match(/-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's an empty folder\./i) ||
    rawLog.match(/TRACE SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\(from Mods\\[^)]*\)\.\.\.[\s\S]*?Failed:\s+it's an empty folder\./i);

  const matchedMod = emptyFolderMatch?.[1]?.trim() || mods[0] || "the empty mod folder";

  const hasEmptyFolderPattern =
    Boolean(emptyFolderMatch) ||
    lowerLog.includes("because it's an empty folder") ||
    (lowerLog.includes("skipped mods") && lowerLog.includes("empty folder")) ||
    quickIssue.includes("empty mod folder") ||
    quickIssue.includes("skipped empty mod folder") ||
    quickError.includes("emptyfolder") ||
    highlights.some((line) => line.toLowerCase().includes("empty folder"));

  if (!hasEmptyFolderPattern) {
    return null;
  }

  return {
    quickFixFirst: `Delete the empty folder for ${matchedMod} from your Mods folder.`,
    issue: `The game is skipping a mod because its folder is empty.`,
    confidenceLevel: "High" as const,
    probabilityBreakdown: [
      `100% - The empty folder for ${matchedMod} is the cause of this warning.`,
    ],
    mostLikelyCause: `The mod ${matchedMod} is not properly installed because its folder is empty.`,
    recommendedFixSteps: [
      `Delete the empty folder for ${matchedMod} from your Mods folder.`,
      `Launch Stardew Valley again after removing it so SMAPI creates a fresh log.`,
      `Load the newest SMAPI log after that launch to confirm the warning is gone.`,
    ],
    needMoreInfo:
      `If you still see the same warning after removing it, you may be looking at an older log. Launch the game again and load the newest SMAPI log.`,
    detectedSignals: {
      suspectedMods: [matchedMod],
      likelyCategory: "advisory_empty_folder" as const,
      advisoryLevel: "advisory" as const,
      advisoryTitle: "Empty mod folder found",
      advisoryMessage: `${matchedMod} is an empty folder. This is a warning cleanup issue, not a full game crash.`,
    },
  };
}

function hasRuntimeSessionStart(text: string, gameKey = "") {
  const lower = String(text || "").toLowerCase();

  const genericPatterns = [
    "client disconnected with reason:",
    "connected to server",
    "joined the game",
    "joined world",
    "loading 158 mods",
    "loading mods:",
    "starting jei",
    "sending runtime unavailable",
    "stopping jei",
  ];

  const minecraftPatterns = [
    "essential connection manager",
    "essential-sps",
    "quic backend",
    "loading minecraft",
    "render thread/info",
    "loaded 158 mods",
  ];

  const patterns =
    gameKey === "minecraft"
      ? [...genericPatterns, ...minecraftPatterns]
      : genericPatterns;

  return patterns.some((pattern) => lower.includes(pattern));
}

function hasLateDisconnect(text: string) {
  const lower = String(text || "").toLowerCase();

  return (
    lower.includes("readtimeoutexception") ||
    lower.includes("client disconnected with reason: timed out") ||
    lower.includes("timed out")
  );
}

function hasEssentialRuntimeSignals(text: string) {
  const lower = String(text || "").toLowerCase();

  return (
    lower.includes("essential") ||
    lower.includes("essential-sps") ||
    lower.includes("cdn.essential.gg") ||
    lower.includes("essential connection manager") ||
    lower.includes("quic backend")
  );
}

function detectLauncherFromLog(crashLog: string) {
  const lower = String(crashLog || "").toLowerCase();

  if (
    lower.includes("curseforge") ||
    lower.includes("overwolf") ||
    lower.includes("\\curseforge\\") ||
    lower.includes("/curseforge/")
  ) {
    return "CurseForge";
  }

  if (
    lower.includes("prism launcher") ||
    lower.includes("\\prismlauncher\\") ||
    lower.includes("/prismlauncher/") ||
    lower.includes("\\prism\\instances\\") ||
    lower.includes("/prism/instances/")
  ) {
    return "Prism Launcher";
  }

  if (
    lower.includes("multimc") ||
    lower.includes("\\multimc\\") ||
    lower.includes("/multimc/")
  ) {
    return "MultiMC";
  }

  if (
    lower.includes("modrinth app") ||
    lower.includes("\\modrinthapp\\") ||
    lower.includes("/modrinthapp/")
  ) {
    return "Modrinth App";
  }

  if (
    lower.includes(".minecraft") ||
    lower.includes("minecraft launcher")
  ) {
    return "Minecraft Launcher";
  }

  return "";
}

function fallbackAnalyze(
  crashLog: string,
  gameKey = "",
  gameTitle = "Unknown Game",
  continuedDiagnostic?: {
    issue?: string;
    likelyCategory?: string;
    previousText?: string;
    suspectedMods?: string[];
    previousRelevantLog?: string;
  } | null
): AnalyzeModelResponse {
  const lower = crashLog.toLowerCase();
  const normalizedGameKey = typeof gameKey === "string" ? gameKey : "";
  const normalizedGameTitle = typeof gameTitle === "string" ? gameTitle : "Unknown Game";
  
  const suspectedMods: string[] = [];

  const isMissingBaseGameFile =
  /Content[\\/][A-Za-z0-9_ .()[\]\-\\/]+?\.(xnb|xgs)/i.test(crashLog) ||
  /ContentLoadException/i.test(crashLog) ||
  /FileNotFoundException:\s*Content[\\/]/i.test(crashLog);
  const runtimeSessionStarted = hasRuntimeSessionStart(crashLog, normalizedGameKey);
  const lateDisconnectDetected = hasLateDisconnect(crashLog);
  const essentialRuntimeSignals = hasEssentialRuntimeSignals(crashLog);
  const launcher = detectLauncherFromLog(crashLog);

    if (isMissingBaseGameFile) {
  const missingAssetMatch =
    crashLog.match(/FileNotFoundException:\s*(Content[\\/][^\\\n\r]+?\.(?:xnb|xgs))/i) ||
    crashLog.match(/Could not find a part of the path\s+'[^']*?(Content[\\/][^']+?\.(?:xnb|xgs))'/i) ||
    crashLog.match(/Failed loading asset\s+'([^']+)'/i);

  const missingAsset =
    missingAssetMatch?.[1]?.replace(/\//g, "\\") ||
    "a required Stardew Valley content file";

  return {
    quickFixFirst: "Verify Stardew Valley’s game files through Steam.",

    issue:
      "Required base game files are missing or corrupted, preventing the game from loading.",

    confidenceLevel: "High",

    probabilityBreakdown: [
      "90% - Missing or corrupted base game files",
      "10% - A mod exposed the issue during load",
    ],

    mostLikelyCause:
      `${missingAsset} is missing or corrupted in the game's Content folder.`,

    recommendedFixSteps: [
      "Close the game completely.",
      "Open Steam.",
      "Go to your Library.",
      "Right-click Stardew Valley → Properties.",
      "Go to Installed Files.",
      "Click 'Verify integrity of game files'.",
      "Wait for Steam to repair missing files.",
      "Launch the game again.",
    ],

    needMoreInfo:
      "If verifying files does not fix the issue, reinstall Stardew Valley or provide a new log after the next crash.",

    detectedSignals: {
      errorType: "ContentLoadException",
      loader: "SMAPI",
      gameVersion: "",
      javaVersion: "",
      suspectedMods: [],
      likelyCategory: "game_files_corrupt",
    },
  };
}

  const skyrimRuntimeMismatchMatch = crashLog.match(
    /plugin\s+([A-Za-z0-9_.-]+\.dll)[\s\S]*?reported as incompatible[\s\S]*?expected runtime\s+([0-9.]+),\s*got\s+([0-9.]+)/i
  );

  if (normalizedGameKey === "skyrimse" && skyrimRuntimeMismatchMatch) {
    const pluginName = skyrimRuntimeMismatchMatch[1] || "the SKSE plugin";
    const expectedRuntime = skyrimRuntimeMismatchMatch[2] || "the expected runtime";
    const currentRuntime = skyrimRuntimeMismatchMatch[3] || "your current runtime";

    return {
      quickFixFirst: `Update ${pluginName} for Skyrim runtime ${currentRuntime}.`,
      issue: `${pluginName} is built for Skyrim runtime ${expectedRuntime}, but your game is running runtime ${currentRuntime}.`,
      confidenceLevel: "High",
      probabilityBreakdown: [
        `100% - ${pluginName} runtime version mismatch`,
      ],
      mostLikelyCause:
        `${pluginName} does not match your current Skyrim/SKSE runtime version.`,
      recommendedFixSteps: [
        `Download the version of ${pluginName} made for Skyrim runtime ${currentRuntime}.`,
        `Replace the old ${pluginName} file in your SKSE Plugins folder.`,
        "Make sure SKSE, Address Library, and DLL plugins all match the same Skyrim runtime.",
        "Relaunch Skyrim after updating the plugin.",
      ],
      needMoreInfo:
        "If the crash continues, provide the updated SKSE log and the exact Skyrim runtime/SKSE versions.",
      detectedSignals: {
        errorType: "SkyrimRuntimeMismatch",
        loader: "SKSE / Mod Manager",
        gameVersion: currentRuntime,
        javaVersion: "",
        suspectedMods: [pluginName.replace(/\.dll$/i, ""), "skse"],
        likelyCategory: "loader_mismatch",
      },
    };
  }
  
  if (runtimeSessionStarted && lateDisconnectDetected) {
    const runtimeQuickFix = essentialRuntimeSignals
      ? "Temporarily disable Essential and test joining again."
      : "Retest the session and compare the newest log from the moment the disconnect happens.";

    const runtimeIssue = essentialRuntimeSignals
      ? "The game launches and runs for a while, but the session later times out during an Essential connection."
      : "The game launches and runs for a while, but the session later times out during gameplay.";

    const runtimeCause = essentialRuntimeSignals
      ? "This looks like a runtime connection/session timeout tied to Essential or its network session layer, not a startup crash."
      : "This looks like a runtime connection/session timeout that happens after launch, not a startup crash.";

    const runtimeSteps = essentialRuntimeSignals
      ? [
          "Temporarily disable Essential and test joining again.",
          "If the timeout stops, keep Essential disabled or update/reconfigure it.",
          "If the timeout still happens, compare the client and host modpacks again and load the newest log after reproducing it.",
        ]
      : [
          "Retest and capture the newest log from the exact moment the disconnect happens.",
          "Compare the client and host/server modpacks for mismatches.",
          "Treat earlier startup warnings as secondary unless the game also fails before joining.",
        ];

    return {
      quickFixFirst: runtimeQuickFix,
      issue: runtimeIssue,
      confidenceLevel: "High",
      probabilityBreakdown: [
        essentialRuntimeSignals
          ? "85% - Runtime timeout tied to Essential/session networking"
          : "75% - Runtime session timeout after launch",
        "15% - Secondary mod compatibility warning",
      ],
      mostLikelyCause: runtimeCause,
      recommendedFixSteps: runtimeSteps,
      needMoreInfo:
        "Because the game launched and only failed later, runtime timeout/session causes should be prioritized over startup warnings in this log.",
      detectedSignals: {
        errorType: "ReadTimeoutException",
        loader:
          normalizedGameKey === "minecraft"
            ? (lower.includes("fabric") ? "Fabric" : lower.includes("forge") ? "Minecraft Forge" : "")
            : "",
        gameVersion: "",
        javaVersion: "",
        suspectedMods: essentialRuntimeSignals ? ["essential"] : [],
        likelyCategory: essentialRuntimeSignals
          ? "network_mod_failure"
          : "runtime_disconnect",
      },
    };
  }

    if (isHealthyLog(crashLog, normalizedGameKey)) {
  const currentMods = extractSuspectedMods(crashLog, normalizedGameKey);
  return buildContinuationAwareHealthyResult({
    gameTitle: normalizedGameTitle,
    continuedDiagnostic,
    currentMods,
  });
}
  
  if (typeof crashLog === "string" && crashLog.toLowerCase().includes("mezz/jei")) {
  if (!suspectedMods.includes("jei")) {
    suspectedMods.unshift("jei"); // force it to be FIRST
  }
}

if (normalizedGameKey === "custom") {
  const leadSuspect = suspectedMods[0] || "the most recently added mod or plugin";

  return {
    quickFixFirst: `Start by testing without ${leadSuspect}.`,
    issue: `FixMyGame found signs of a mod, plugin, or setup issue in this ${normalizedGameTitle} log, but the exact failure is not fully confirmed yet.`,
    confidenceLevel: "Medium",
    probabilityBreakdown: [
      "50% - Mod or plugin conflict",
      "30% - Missing dependency or version mismatch",
      "20% - Incomplete or wrong log",
    ],
    mostLikelyCause:
      "A mod/plugin conflict, missing dependency, version mismatch, or incomplete install is more likely than a clean/no-issue state.",
    recommendedFixSteps: [
      `Disable or remove ${leadSuspect} first, then test again.`,
      "Check that all mods/plugins match the exact game version and required frameworks.",
      "If the issue continues, load the newest crash or error log created immediately after reproducing it.",
    ],
    needMoreInfo:
      "If this is still too generic, use Continue Diagnostic or Still Crashing and describe exactly what FixMyGame missed.",
    detectedSignals: {
      suspectedMods,
      likelyCategory: "unknown",
    },
  };
}

  const suspiciousNamespaces: Array<{ needle: string; mod: string }> = [
  { needle: "mezz/jei", mod: "jei" },
  { needle: "jei/", mod: "jei" },
  { needle: "fabric-api", mod: "fabric-api" },
  { needle: "fabric_api", mod: "fabric-api" },
  { needle: "sodium", mod: "sodium" },
  { needle: "iris", mod: "iris" },
  { needle: "oculus", mod: "oculus" },
  { needle: "optifine", mod: "optifine" },
  { needle: "rubidium", mod: "rubidium" },
  { needle: "embeddium", mod: "embeddium" },
  { needle: "skse", mod: "skse" },
  { needle: "address library", mod: "address library" },
  { needle: "f4se", mod: "f4se" },
  { needle: "buffout", mod: "buffout" },
  { needle: "mccc", mod: "mccc" },
  { needle: "wickedwhims", mod: "wickedwhims" },
  { needle: "basemental", mod: "basemental" },
  { needle: "xml injector", mod: "xml injector" },
];

for (const entry of suspiciousNamespaces) {
  if (lower.includes(entry.needle) && !suspectedMods.includes(entry.mod)) {
    suspectedMods.push(entry.mod);
  }
}

if (normalizedGameKey === "minecraft") {
  const modRegex =
    /mod file:\s*([^\s]+)|failure message:\s*([a-z0-9_\-]+)|([a-z0-9_\-]+):\s+[a-z0-9 ._\-]+/gi;

  let match: RegExpExecArray | null;
  while ((match = modRegex.exec(crashLog)) !== null) {
    const raw = match[1] || match[2] || match[3];
    if (!raw) continue;

    const cleaned = raw.replace(/\.jar$/i, "").trim();
    const blacklist = new Set([
      "minecraft",
      "forge",
      "fabric",
      "quilt",
      "java",
      "memory",
      "thread",
      "details",
    ]);

    if (cleaned && !blacklist.has(cleaned.toLowerCase()) && !suspectedMods.includes(cleaned)) {
      suspectedMods.push(cleaned);
    }
  }
} else if (normalizedGameKey === "sims4") {
  const knownMods = ["mccc", "wickedwhims", "basemental", "xml injector", "better exceptions", "ui cheats", "tmex"];
  for (const mod of knownMods) {
    if (lower.includes(mod) && !suspectedMods.includes(mod)) {
      suspectedMods.push(mod);
    }
  }
} else if (normalizedGameKey === "skyrimse") {
  const knownMods = ["skse", "address library", "skyui", "fnis", "nemesis", "dyndolod", "enb", "ussep"];
  for (const mod of knownMods) {
    if (lower.includes(mod) && !suspectedMods.includes(mod)) {
      suspectedMods.push(mod);
    }
  }
} else if (normalizedGameKey === "fallout4") {
  const knownMods = ["f4se", "buffout", "looksmenu", "mcm", "sim settlements", "unofficial patch"];
  for (const mod of knownMods) {
    if (lower.includes(mod) && !suspectedMods.includes(mod)) {
      suspectedMods.push(mod);
    }
  }
}

  let errorType = "UnknownError";

  if (lower.includes("outofmemoryerror") || lower.includes("java heap space")) {
    errorType = "OutOfMemoryError";
  } else if (lower.includes("mixinapplyerror")) {
    errorType = "MixinApplyError";
  } else if (lower.includes("mixintransformererror")) {
    errorType = "MixinTransformerError";
  } else if (lower.includes("missingmodsexception")) {
    errorType = "MissingModsException";
  } else if (lower.includes("nosuchmethoderror")) {
    errorType = "NoSuchMethodError";
  } else if (lower.includes("nullpointerexception")) {
    errorType = "NullPointerException";
  } else if (lower.includes("openglexception")) {
    errorType = "OpenGLException";
  } else if (lower.includes("illegalargumentexception")) {
    errorType = "IllegalArgumentException";
  }

  let loader: DetectedSignals["loader"] = "";

if (normalizedGameKey === "minecraft") {
  if (lower.includes("minecraft forge") || lower.includes("forge")) loader = "Minecraft Forge";
  else if (lower.includes("fabric loader") || lower.includes("fabric")) loader = "Fabric";
  else if (lower.includes("quilt")) loader = "Quilt";
} else if (normalizedGameKey === "sims4") {
  loader = "Script Mods / CC";
} else if (normalizedGameKey === "skyrimse") {
  loader = "SKSE / Mod Manager";
} else if (normalizedGameKey === "fallout4") {
  loader = "F4SE / Mod Manager";
}

  const versionMatch = crashLog.match(/(?:minecraft version|game version|minecraft version id):\s*([0-9.]+)/i);
  const gameVersion = versionMatch?.[1] || "";

  const javaMatch = crashLog.match(/java version:\s*([0-9._]+)/i);
  const javaVersion = javaMatch?.[1] || "";

  let likelyCategory: DetectedSignals["likelyCategory"] = "unknown";

  if (normalizedGameKey === "sims4") {
  if (
    lower.includes("lastexception") ||
    lower.includes("script call failed") ||
    lower.includes("xml injector") ||
    lower.includes("mccc") ||
    lower.includes("wickedwhims")
  ) {
    likelyCategory = "mod_conflict";
  }
}

if (normalizedGameKey === "skyrimse") {
  if (
    lower.includes("skse") ||
    lower.includes("address library") ||
    lower.includes("dll") ||
    lower.includes("plugin")
  ) {
    likelyCategory = "mod_conflict";
  }
}

if (normalizedGameKey === "fallout4") {
  if (
    lower.includes("f4se") ||
    lower.includes("buffout") ||
    lower.includes("dll") ||
    lower.includes("plugin")
  ) {
    likelyCategory = "mod_conflict";
  }
}

  const hasForge = lower.includes("forge");
  const hasFabric = lower.includes("fabric");
  const hasShaderWords =
    lower.includes("shader") ||
    lower.includes("optifine") ||
    lower.includes("iris") ||
    lower.includes("oculus") ||
    lower.includes("rubidium") ||
    lower.includes("sodium");
  const hasDriverWords =
    lower.includes("driver") ||
    lower.includes("graphics card") ||
    lower.includes("gpu") ||
    lower.includes("opengl") ||
    lower.includes("lwjgl");

  if (likelyCategory === "unknown" && (lower.includes("outofmemoryerror") || lower.includes("java heap space"))) {
    likelyCategory = "out_of_memory";
  } else if (lower.includes("missingmodsexception") || lower.includes("missing dependency") || lower.includes("missing mods")) {
    likelyCategory = "missing_dependency";
  } else if (lower.includes("mixinapplyerror") || lower.includes("mixintransformererror") || lower.includes("mixin")) {
    likelyCategory = "mixin_failure";
  } else if (hasShaderWords && (lower.includes("render") || lower.includes("shader") || lower.includes("opengl"))) {
    likelyCategory = "shader_crash";
  } else if (hasDriverWords && (lower.includes("driver") || lower.includes("opengl") || lower.includes("lwjgl"))) {
    likelyCategory = "gpu_driver_issue";
  } else if (
    (hasForge && suspectedMods.some((m) => ["sodium", "iris", "fabric-api"].includes(m.toLowerCase()))) ||
    (hasFabric && suspectedMods.some((m) => ["optifine", "forge"].includes(m.toLowerCase())))
  ) {
    likelyCategory = "loader_mismatch";
  } else if (
    javaVersion &&
    (javaVersion.startsWith("1.8") || javaVersion.startsWith("8")) &&
    gameVersion &&
    Number(gameVersion.split(".")[1] || "0") >= 18
  ) {
    likelyCategory = "java_mismatch";
  } else if (lower.includes("nosuchmethoderror") || lower.includes("incompatible") || lower.includes("conflict")) {
    likelyCategory = "mod_conflict";
  }

let quickFixFirst = "Disable the most recently added or updated mod and test again.";
let issue = `Possible mod conflict or version mismatch in the current ${normalizedGameTitle} setup.`;
let mostLikelyCause =
  "One or more installed mods or plugins appear incompatible with the current game build or another installed mod.";
let probabilityBreakdown = buildLikelihoodBreakdown([
  {
    label: "Mod conflict",
    strength: "most_likely",
  },
  {
    label: "Version mismatch",
    strength: "possible",
  },
  {
    label: "Missing dependency",
    strength: "possible",
  },
]);
let recommendedFixSteps = [
  "Remove the most recently added or updated mod and test launch again.",
  "Check the mod's supported game and loader/plugin versions.",
  "Verify required dependencies are installed.",
  "Temporarily remove graphics or script/plugin-heavy mods if the issue persists.",
];
let needMoreInfo =
  "Provide the newest crash log and exact installed mod version if the issue continues.";

if (normalizedGameKey === "stardew_valley") {
  if (
    lower.includes("installer isn't a mod") ||
    lower.includes("smapi installer isn't a mod") ||
    lower.includes("skipped mods")
  ) {
    quickFixFirst = "Delete the SMAPI installer folder from your Mods folder.";

    issue = "A non-mod installer folder is in your Mods folder, so the game is skipping it.";

    mostLikelyCause =
      "The SMAPI installer folder was left inside your Mods folder after installation.";

    probabilityBreakdown = [
      "100% - Non-mod installer folder in Mods"
    ];

    recommendedFixSteps = [
      "Delete the “SMAPI 4.5.2 installer” folder from your Mods folder.",
      "Restart Stardew Valley and check if your mods load normally.",
      "Run another diagnostic only if the issue continues."
    ];
  }
}

if (normalizedGameKey === "sims4") {
  quickFixFirst = "Remove recently added script mods or CC, then relaunch.";
  issue = "A Sims 4 script mod or CC conflict is likely.";
  mostLikelyCause = "One or more script mods or custom content packages are outdated or conflicting after a game update.";
  probabilityBreakdown = [
    "Broken script mod: 60%",
    "CC conflict: 25%",
    "Patch incompatibility: 15%",
  ];
  recommendedFixSteps = [
    "Remove recently added script mods and test again.",
    "Update MCCC, WickedWhims, Basemental, XML Injector, and other core mods.",
    "Delete lastException files and relaunch.",
    "Test with CC disabled if the issue continues.",
  ];
}

if (normalizedGameKey === "skyrimse") {
  quickFixFirst = "Disable recently added SKSE plugins or mods, then relaunch.";
  issue = "A Skyrim SE plugin or load-order conflict is likely.";
  mostLikelyCause = "An SKSE plugin, DLL mod, or load-order issue is causing the crash.";
  probabilityBreakdown = buildLikelihoodBreakdown([
  {
    label: "Plugin conflict",
    strength: "most_likely",
  },
  {
    label: "Address Library / SKSE mismatch",
    strength: "possible",
  },
  {
    label: "Load order issue",
    strength: "possible",
  },
]);
  recommendedFixSteps = [
    "Disable recently installed plugins or DLL mods.",
    "Update SKSE and Address Library.",
    "Check load order in your mod manager.",
    "Retest with core UI/gameplay mods disabled one at a time.",
  ];
}

if (normalizedGameKey === "fallout4") {
  quickFixFirst = "Disable recently added F4SE plugins or mods, then relaunch.";
  issue = "A Fallout 4 plugin or load-order conflict is likely.";
  mostLikelyCause = "An F4SE plugin, Buffout-related issue, or mod conflict is causing the crash.";
  probabilityBreakdown = [
    "Plugin conflict: 55%",
    "F4SE / Buffout mismatch: 30%",
    "Load order issue: 15%",
  ];
  recommendedFixSteps = [
    "Disable recently installed plugins or DLL mods.",
    "Update F4SE and Buffout if used.",
    "Check load order in your mod manager.",
    "Retest with large gameplay/UI mods disabled one at a time.",
  ];
}

  if (likelyCategory === "out_of_memory") {
    quickFixFirst = "Increase allocated RAM and remove heavy mods or shaders temporarily.";
    issue = "The game ran out of Java heap memory.";
    mostLikelyCause = "Too little allocated RAM, a very large modpack, or heavy resource/shader usage.";
    probabilityBreakdown = [
      "Insufficient RAM allocation: 70%",
      "Heavy modpack/resource usage: 20%",
      "Memory leak or unstable mod: 10%",
    ];
    recommendedFixSteps = [
      "Increase Java RAM allocation in the launcher.",
      "Disable shaders and high-resolution resource packs.",
      "Temporarily remove the heaviest mods and retest.",
      "Close other memory-heavy apps before launching.",
    ];
  } else if (likelyCategory === "mixin_failure") {
  const leadMod = suspectedMods[0] || "the mod named near the mixin error";

  quickFixFirst = `Update or remove ${leadMod} first, then retest launch.`;
  issue = "A mixin failed to apply during startup or runtime.";
  mostLikelyCause = `${leadMod} appears tied to a missing class, incompatible target, wrong mod version, or loader mismatch.`;
  probabilityBreakdown = [
    `Incompatible mod version (${leadMod}): 60%`,
    "Loader/version mismatch: 25%",
    "Conflict with another core mod: 15%",
  ];
  recommendedFixSteps = [
    `Update ${leadMod} to a version that matches your Minecraft and loader version.`,
    `Temporarily remove ${leadMod} and retest launch.`,
    "Confirm all mods match your exact Minecraft and loader version.",
    "Review the first stack trace lines around the mixin/class error for related dependencies.",
  ];
} else if (likelyCategory === "missing_dependency") {
  const missingComponentRaw =
    extractMissingComponentFromText(crashLog) ||
    extractMissingComponentFromText(suspectedMods.join(" "));

  const missingComponentDisplay =
    normalizedGameKey === "minecraft"
      ? inferMinecraftDisplayName(missingComponentRaw)
      : missingComponentRaw || "required component";

  const dependencyResolution = resolveDependencyState({
    rawComponent: missingComponentRaw,
    detectedMods: suspectedMods,
    crashLog,
    gameKey: normalizedGameKey,
  });

  const { dependencyState, recommendedAction } = dependencyResolution;

    if (runtimeSessionStarted && lateDisconnectDetected) {
    return {
      quickFixFirst: essentialRuntimeSignals
        ? "Temporarily disable Essential and test joining again."
        : "Treat the timeout as the primary issue first, then come back to the dependency warning if it still matters.",
      issue: essentialRuntimeSignals
        ? "A dependency warning is present, but the game actually launches and later times out during an Essential session."
        : "A dependency warning is present, but the game actually launches and later times out during gameplay.",
      confidenceLevel: "High",
      probabilityBreakdown: essentialRuntimeSignals
        ? [
            "85% - Runtime timeout tied to Essential/session networking",
            "15% - Secondary dependency or compatibility warning",
          ]
        : [
            "70% - Runtime disconnect/session timeout",
            "30% - Secondary dependency or compatibility warning",
          ],
      mostLikelyCause: essentialRuntimeSignals
        ? "The dependency warning appears secondary because the session starts successfully and only fails later during an Essential/network session."
        : "The dependency warning appears secondary because the game/session starts successfully and only fails later.",
      recommendedFixSteps: essentialRuntimeSignals
        ? [
            "Temporarily disable Essential and test joining again.",
            "If the timeout stops, keep Essential disabled or update/reconfigure it.",
            "Only fix the dependency warning next if it still appears after the timeout issue is resolved.",
          ]
        : [
            "Prioritize fixing the timeout/disconnect issue first.",
            "Then update or reinstall the dependency warning shown in the log if it still appears.",
            "Retest with the newest log after reproducing the disconnect again.",
          ],
      needMoreInfo:
        "Because the game launched before failing, this dependency issue should be treated as secondary unless the game also starts failing before launch.",
      detectedSignals: {
        errorType,
        loader,
        gameVersion,
        javaVersion,
        suspectedMods: essentialRuntimeSignals
          ? Array.from(new Set(["essential", ...suspectedMods]))
          : suspectedMods,
        likelyCategory: essentialRuntimeSignals
          ? "network_mod_failure"
          : "runtime_disconnect",
        dependencyState,
        missingComponentRaw,
        missingComponentDisplay,
        recommendedAction,
      },
    };
  }

  if (recommendedAction === "install") {
    quickFixFirst = `Install ${missingComponentDisplay} and relaunch the game.`;
    issue = `${missingComponentDisplay} is required but does not appear to be installed.`;
    mostLikelyCause = `Another mod is trying to use ${missingComponentDisplay}, but it is not currently installed or available to the game.`;
    probabilityBreakdown = [
      `80% - ${missingComponentDisplay} is not installed`,
      "15% - Wrong dependency version expected",
      "5% - Loader/build mismatch",
    ];
    recommendedFixSteps = [
      "Open your Mods folder.",
      `Install ${missingComponentDisplay} for your exact game and loader version.`,
      "Relaunch the game and test again.",
    ];
    needMoreInfo =
      "If the issue continues after installing it, run another diagnostic with the newest log.";
  } else if (recommendedAction === "relaunch") {
    likelyCategory = "dependency_not_initialized";
    quickFixFirst =
      "Close the game fully, then relaunch it once normally so dependencies can initialize.";
    issue = `${missingComponentDisplay} appears to be installed, but it may not have fully initialized yet.`;
    mostLikelyCause = `${missingComponentDisplay} or a related dependency looks present, but the loader may not have completed first-launch setup or initialization.`;
    probabilityBreakdown = [
      "70% - Installed dependency not initialized yet",
      "20% - Launcher state or cache issue",
      "10% - Actual missing or broken dependency",
    ];
    recommendedFixSteps = [
      "Close the game completely.",
      "Launch it once normally and let the mod loader finish setup.",
      "Relaunch through your usual launcher after that if needed.",
      "If the same issue returns, run FixMyGame again with the newest log.",
    ];
    needMoreInfo =
      "If the issue continues after a normal relaunch, provide the newest crash log from that run.";
  } else if (recommendedAction === "update_or_match_version") {
    quickFixFirst = `Update or match the version of ${missingComponentDisplay} to your current game and loader version.`;
    issue = `${missingComponentDisplay} appears to be installed, but the current version may not match the rest of the mod setup.`;
    mostLikelyCause = `${missingComponentDisplay} is present, but the installed version is likely incompatible with the game, loader, or another mod.`;
    probabilityBreakdown = [
      `70% - Wrong version of ${missingComponentDisplay}`,
      "20% - Secondary compatibility mismatch",
      "10% - Incomplete install",
    ];
    recommendedFixSteps = [
      `Check the installed version of ${missingComponentDisplay}.`,
      "Install the version that matches your exact game and loader version.",
      "Remove duplicate or older copies if more than one exists.",
      "Relaunch and test again.",
    ];
    needMoreInfo =
      "If this still fails, provide the exact installed version and newest crash log.";
  } else if (recommendedAction === "reinstall") {
    quickFixFirst = `Reinstall ${missingComponentDisplay} and relaunch the game.`;
    issue = `${missingComponentDisplay} appears to be present, but the game cannot load one of its required classes.`;
    mostLikelyCause = `${missingComponentDisplay} may be corrupted, incomplete, or the wrong build for this setup.`;
    probabilityBreakdown = [
      `70% - Corrupted or incomplete ${missingComponentDisplay} install`,
      "20% - Wrong build/version",
      "10% - Secondary mod conflict",
    ];
    recommendedFixSteps = [
      `Remove the current copy of ${missingComponentDisplay}.`,
      "Download a fresh copy for your exact game and loader version.",
      "Place it back into the Mods folder.",
      "Relaunch and test again.",
    ];
    needMoreInfo =
      "If reinstalling does not help, provide the newest log and the exact file name/version.";
  } else {
    quickFixFirst = `Inspect ${missingComponentDisplay} and related dependencies first.`;
    issue = `${missingComponentDisplay} appears tied to a dependency problem, but the exact state is not fully confirmed yet.`;
    mostLikelyCause =
      "A required dependency may be missing, mismatched, or partially broken.";
    probabilityBreakdown = [
      "50% - Missing dependency",
      "30% - Wrong version",
      "20% - Incomplete or corrupted install",
    ];
    recommendedFixSteps = [
      `Check whether ${missingComponentDisplay} is present in the Mods folder.`,
      "Confirm it matches your exact game and loader version.",
      "Reinstall it if the current copy looks wrong or incomplete.",
      "Run another diagnostic with the newest log if the issue continues.",
    ];
    needMoreInfo =
      "Provide the newest crash log and exact installed mod version if the issue continues.";
  }

  return {
    quickFixFirst,
    issue,
    confidenceLevel: "Medium",
    probabilityBreakdown,
    mostLikelyCause,
    recommendedFixSteps,
    needMoreInfo,
    detectedSignals: {
      errorType,
      loader,
      gameVersion,
      javaVersion,
      suspectedMods,
      likelyCategory,
      dependencyState,
      missingComponentRaw,
      missingComponentDisplay,
      recommendedAction,
    },
  };
} else if (likelyCategory === "shader_crash") {
    quickFixFirst = "Disable shaders first, then retest launch.";
    issue = "A shader or rendering-related crash occurred.";
    mostLikelyCause = "A shader pack, rendering mod, or graphics optimization mod is conflicting with the current setup.";
    probabilityBreakdown = [
      "Shader/render mod conflict: 65%",
      "Graphics settings incompatibility: 20%",
      "Driver-related rendering issue: 15%",
    ];
        recommendedFixSteps = [
      "Disable shaders and retest.",
      "Lower shader quality or resolution before removing the shader pack.",
      "Temporarily remove OptiFine, Iris, Oculus, Sodium, or Rubidium one at a time.",
      "Lower graphics settings and test again.",
      "Update GPU drivers if the crash continues.",
    ];
  } else if (likelyCategory === "gpu_driver_issue") {
    quickFixFirst = "Update or reinstall your GPU driver, then test without rendering mods.";
    issue = "A graphics driver or low-level rendering crash occurred.";
    mostLikelyCause = "The GPU driver, OpenGL stack, or a rendering mod caused the crash.";
    probabilityBreakdown = [
      "Driver issue: 55%",
      "Rendering mod conflict: 30%",
      "Unsupported graphics setting: 15%",
    ];
    recommendedFixSteps = [
      "Update your GPU driver to the latest stable version.",
      "Disable rendering/shader mods temporarily.",
      "Test with default graphics settings.",
      "Reboot and relaunch after driver changes.",
    ];
  } else if (likelyCategory === "loader_mismatch") {
    quickFixFirst = "Remove mods built for the wrong loader.";
    issue = "A Forge/Fabric loader mismatch is likely.";
    mostLikelyCause = "One or more mods appear to be built for a different mod loader than the one currently running.";
    probabilityBreakdown = [
      "Wrong loader mod installed: 75%",
      "Mixed modpack contents: 20%",
      "Incorrect launcher profile: 5%",
    ];
    recommendedFixSteps = [
      "Remove Fabric-only mods from Forge, or Forge-only mods from Fabric.",
      "Double-check the launcher profile uses the intended loader.",
      "Rebuild the mods folder with only one loader ecosystem.",
      "Redownload suspicious mods from the correct loader page.",
    ];
  } else if (likelyCategory === "java_mismatch") {
    quickFixFirst = "Switch to a Java version supported by your modpack and Minecraft version.";
    issue = "The installed Java version may be incompatible.";
    mostLikelyCause = "Minecraft, the loader, or one of the mods expects a newer Java version.";
    probabilityBreakdown = [
      "Wrong Java version: 80%",
      "Launcher using wrong runtime: 15%",
      "Broken Java install: 5%",
    ];
    recommendedFixSteps = [
      "Install and select the correct Java version in your launcher.",
      "Check the modpack or loader documentation for required Java version.",
      "Make sure the launcher is not pointing to an older Java runtime.",
      "Restart the launcher after changing Java.",
    ];
  }

  return {
    quickFixFirst,
    issue,
    confidenceLevel: "Medium",
    probabilityBreakdown,
    mostLikelyCause,
    recommendedFixSteps,
    needMoreInfo:
      "Provide the full crash report, mod list, and loader version for a more precise diagnosis.",
    detectedSignals: {
  errorType,
  loader,
  launcher,
  gameVersion,
  javaVersion,
  suspectedMods,
  likelyCategory,
},
  };
}

function formatPlainText(result: AnalyzeModelResponse) {
  return [
    "Quick Fix First:",
    result.quickFixFirst,
    "",

    `Issue: ${result.issue}`,
    `Confidence Level: ${result.confidenceLevel}`,
    "",

    "Likelihood Breakdown:",
    ...result.probabilityBreakdown.map((line) => `- ${line.replace(/^-+\s*/, "")}`),
    "",

    `Most Likely Cause: ${result.mostLikelyCause}`,
    "",

    ...(result.explanation?.whatThisMeans
      ? [
          "What This Means:",
          result.explanation.whatThisMeans,
          "",
        ]
      : []),

    ...(result.explanation?.whyFixMyGameThinksThis?.length
      ? [
          "Why FixMyGame Thinks This:",
          ...result.explanation.whyFixMyGameThinksThis.map((line) => `- ${line}`),
          "",
        ]
      : []),

    ...(result.explanation?.beginnerExplanation
      ? [
          "Beginner Explanation:",
          result.explanation.beginnerExplanation,
          "",
        ]
      : []),

    "Recommended Fix Steps:",
    ...result.recommendedFixSteps.map((step, i) => `${i + 1}. ${step}`),
    "",

    ...(result.explanation?.doNotDoYet?.length
      ? [
          "Do Not Do This Yet:",
          ...result.explanation.doNotDoYet.map((line) => `- ${line}`),
          "",
        ]
      : []),

    ...(result.explanation?.stillCrashingNextSteps?.length
      ? [
          "If It Still Crashes:",
          ...result.explanation.stillCrashingNextSteps.map((line) => `- ${line}`),
          "",
        ]
      : []),

    `Need More Info: ${result.needMoreInfo}`,
  ].join("\n");
}

function getGameSpecificPrompt(gameKey: string, gameTitle: string) {
  switch (gameKey) {
    case "minecraft":
      return `
You are analyzing a Minecraft modded crash log.
Focus on:
- Forge / Fabric / Quilt issues
- Java version mismatches
- mixin errors
- mod conflicts
- shader mods (OptiFine, Sodium, Iris, etc.)
`;

    case "sims4":
      return `
You are analyzing a Sims 4 mod error.
Focus on:
- broken script mods
- lastException patterns
- MCCC, WickedWhims, Basemental, XML Injector
- CC conflicts and outdated mods
`;

    case "skyrimse":
      return `
You are analyzing a Skyrim Special Edition crash.
Focus on:
- SKSE issues
- Address Library mismatch
- DLL/plugin crashes
- load order conflicts
`;

    case "fallout4":
      return `
You are analyzing a Fallout 4 crash.
Focus on:
- F4SE issues
- Buffout logs
- plugin failures
- load order conflicts
`;

    default:
      return `
You are analyzing a modded PC game crash log for ${gameTitle}.
Focus on:
- mod conflicts
- missing dependencies
- plugin failures
- rendering issues
`;
  }
}

function applyForcedSuspiciousMod(
  normalized: AnalyzeModelResponse,
  forcedSuspiciousMod: string,
  mostSuspiciousLine?: string
): AnalyzeModelResponse {
  if (!forcedSuspiciousMod) return normalized;

  const currentMods = Array.isArray(normalized.detectedSignals?.suspectedMods)
    ? normalized.detectedSignals.suspectedMods.filter(Boolean)
    : [];

  const reorderedMods = [
    forcedSuspiciousMod,
    ...currentMods.filter(
      (mod) => mod.toLowerCase() !== forcedSuspiciousMod.toLowerCase()
    ),
  ];

  if (normalized.detectedSignals?.likelyCategory === "advisory_empty_folder") {
  return normalized;
}
if (
  normalized.detectedSignals?.dependencyState ||
  normalized.detectedSignals?.recommendedAction ||
  normalized.detectedSignals?.missingComponentDisplay
) {
  return {
    ...normalized,
    detectedSignals: {
      ...normalized.detectedSignals,
      suspectedMods: reorderedMods,
    },
  };
}
  const suspiciousLineLower = (mostSuspiciousLine || "").toLowerCase();

    const runtimeSessionStarted = hasRuntimeSessionStart(
    [normalized.issue, normalized.mostLikelyCause, normalized.needMoreInfo].join(" ")
    );

    const lateDisconnectDetected =
    normalized.issue.toLowerCase().includes("timed out") ||
    normalized.mostLikelyCause.toLowerCase().includes("timed out") ||
    normalized.mostLikelyCause.toLowerCase().includes("session timeout") ||
    normalized.needMoreInfo.toLowerCase().includes("timeout");

  let likelyCategory = normalized.detectedSignals?.likelyCategory || "unknown";
  let quickFixFirst = normalized.quickFixFirst;
  let issue = normalized.issue;
  let mostLikelyCause = normalized.mostLikelyCause;
  let probabilityBreakdown = normalized.probabilityBreakdown;
  let recommendedFixSteps = normalized.recommendedFixSteps;
  let needMoreInfo = normalized.needMoreInfo;
  let errorType = normalized.detectedSignals?.errorType || "";

    if (runtimeSessionStarted && lateDisconnectDetected) {
    return {
      ...normalized,
      detectedSignals: {
        ...normalized.detectedSignals,
        suspectedMods: reorderedMods,
      },
    };
  }

  if (
    suspiciousLineLower.includes("classnotfoundexception") ||
    suspiciousLineLower.includes("nosuchmethoderror") ||
    suspiciousLineLower.includes("missing")
  ) {
    likelyCategory = "missing_dependency";
    errorType = errorType || "ClassNotFoundException";
    quickFixFirst = `Update or reinstall ${forcedSuspiciousMod} and its required dependencies.`;
    issue = `${forcedSuspiciousMod} is referencing a class or dependency that is not present.`;
    mostLikelyCause = `${forcedSuspiciousMod} is the primary failing mod, likely due to a missing dependency, wrong version, or incompatible build.`;
    probabilityBreakdown = [
      `70% - Missing dependency or wrong version for ${forcedSuspiciousMod}`,
      "20% - Loader / Minecraft version mismatch",
      "10% - Secondary mod conflict",
    ];
    recommendedFixSteps = [
      `Update ${forcedSuspiciousMod} to the correct version for your Minecraft and loader version.`,
      `Install any dependency ${forcedSuspiciousMod} requires, such as JEI API/library components if applicable.`,
      `Temporarily remove ${forcedSuspiciousMod} and relaunch to confirm it is the trigger.`,
    ];
    needMoreInfo =
      "If the issue continues, provide the exact mod version and the full stack trace around the suspicious line.";
  } else {
    likelyCategory = "mixin_failure";
    quickFixFirst = `Update or remove ${forcedSuspiciousMod} first, then retest launch.`;
    issue = `${forcedSuspiciousMod} appears to be the primary mod tied to the suspicious line.`;
    mostLikelyCause = `${forcedSuspiciousMod} is likely incompatible with the current game, loader, or another installed mod.`;
    probabilityBreakdown = [
      `65% - ${forcedSuspiciousMod} version mismatch or broken patch`,
      "25% - Loader / game mismatch",
      "10% - Secondary mod conflict",
    ];
    recommendedFixSteps = [
      `Update ${forcedSuspiciousMod} to the newest compatible version.`,
      `Temporarily remove ${forcedSuspiciousMod} and relaunch.`,
      "Verify all mods match the exact Minecraft and loader version.",
    ];
  }

  return {
    ...normalized,
    quickFixFirst,
    issue,
    mostLikelyCause,
    probabilityBreakdown,
    recommendedFixSteps,
    needMoreInfo,
    detectedSignals: {
      ...normalized.detectedSignals,
      errorType,
      likelyCategory,
      suspectedMods: reorderedMods,
    },
  };
}

function normalizeLogForComparison(log: string) {
  return log
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const MINECRAFT_COMPONENT_DISPLAY_NAMES: Record<string, string> = {
  jei: "Just Enough Items (JEI)",
  "mezz.jei": "Just Enough Items (JEI)",
  architectury: "Architectury API",
  "cloth-config": "Cloth Config",
  clothconfig: "Cloth Config",
  "animal_feeding_trough": "Animal Feeding Trough",
  "fabric-api": "Fabric API",
  fabricapi: "Fabric API",
  balm: "Balm",
  appleskin: "AppleSkin",
};

function normalizeComponentName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, " ")
    .trim();
}

function extractMissingComponentFromText(text: string) {
  const source = String(text || "");

  const classMatch =
    source.match(/ClassNotFoundException:\s*([A-Za-z0-9_./$-]+)/i) ||
    source.match(/NoClassDefFoundError:\s*([A-Za-z0-9_./$-]+)/i) ||
    source.match(/ModuleNotFound(?:Error|Exception)[:\s]+([A-Za-z0-9_./$-]+)/i);

  if (classMatch?.[1]) {
    return classMatch[1];
  }

  const requiresMatch =
    source.match(/requires(?:\s+any\s+version\s+of)?\s+([A-Za-z0-9_.-]+)/i) ||
    source.match(/missing(?:\s+dependency)?[:\s]+([A-Za-z0-9_.-]+)/i);

  if (requiresMatch?.[1]) {
    return requiresMatch[1];
  }

  return "";
}

function inferMinecraftDisplayName(rawComponent: string) {
  const normalized = normalizeComponentName(rawComponent);

  for (const [key, display] of Object.entries(MINECRAFT_COMPONENT_DISPLAY_NAMES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return display;
    }
  }

  const shortName = normalized
    .split(/[./\s]+/)
    .filter(Boolean)
    .slice(-1)[0];

  if (!shortName) return rawComponent || "required component";

  return shortName
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveDependencyState(params: {
  rawComponent: string;
  detectedMods?: string[];
  crashLog?: string;
  gameKey?: string;
}): {
  dependencyState:
    | "missing_not_installed"
    | "installed_but_not_loaded"
    | "installed_but_wrong_version"
    | "installed_but_corrupted"
    | "unknown_dependency_state";
  recommendedAction:
    | "install"
    | "relaunch"
    | "update_or_match_version"
    | "reinstall"
    | "inspect";
} {
  const rawComponent = String(params.rawComponent || "");
  const detectedMods = Array.isArray(params.detectedMods) ? params.detectedMods : [];
  const crashLog = String(params.crashLog || "");
  const gameKey = String(params.gameKey || "").toLowerCase();

  const normalizedRaw = normalizeComponentName(rawComponent);
  const detectedLower = detectedMods.map((m) => normalizeComponentName(m));
  const textLower = crashLog.toLowerCase();

  const appearsInstalled = detectedLower.some(
    (mod) =>
      mod.includes(normalizedRaw) ||
      normalizedRaw.includes(mod) ||
      (normalizedRaw.includes("jei") && mod.includes("jei")) ||
      (normalizedRaw.includes("architect") && mod.includes("architect")) ||
      (normalizedRaw.includes("cloth") && mod.includes("cloth")) ||
      (normalizedRaw.includes("feeding") && mod.includes("feeding"))
  );

  const firstLaunchPattern =
    textLower.includes("preparing jars on first launch") ||
    textLower.includes("first launch") ||
    textLower.includes("this may take a few seconds");

  if (!appearsInstalled) {
    return {
      dependencyState: "missing_not_installed",
      recommendedAction: "install",
    };
  }

  if (gameKey.includes("minecraft") && firstLaunchPattern) {
    return {
      dependencyState: "installed_but_not_loaded",
      recommendedAction: "relaunch",
    };
  }

  if (
    textLower.includes("wrong version") ||
    textLower.includes("requires version") ||
    textLower.includes("incompatible")
  ) {
    return {
      dependencyState: "installed_but_wrong_version",
      recommendedAction: "update_or_match_version",
    };
  }

  if (
    textLower.includes("classnotfoundexception") ||
    textLower.includes("noclassdeffounderror")
  ) {
    return {
      dependencyState: "installed_but_corrupted",
      recommendedAction: "reinstall",
    };
  }

  return {
    dependencyState: "unknown_dependency_state",
    recommendedAction: "inspect",
  };
}

function buildDefaultExplanation(
  result: AnalyzeModelResponse
): NonNullable<AnalyzeModelResponse["explanation"]> {
  const category = result.detectedSignals?.likelyCategory || "unknown";
  const suspectedMods = result.detectedSignals?.suspectedMods || [];
  const errorType = result.detectedSignals?.errorType || "";
  const loader = result.detectedSignals?.loader || "";

  const suspectText =
    suspectedMods.length > 0
      ? suspectedMods.join(", ")
      : "the mod or dependency named in the log";

  if (category === "missing_dependency" || category === "dependency_not_initialized") {
    return {
      whatThisMeans:
        "A mod is trying to use another mod, library, or API that is not currently available to the game.",
      whyFixMyGameThinksThis: [
        result.issue,
        result.mostLikelyCause,
        errorType ? `The log includes ${errorType}.` : "",
        suspectedMods.length > 0
          ? `The suspected mod or component is: ${suspectText}.`
          : "",
      ].filter(Boolean),
      beginnerExplanation:
        "A dependency is something one mod needs in order to work. If that required piece is missing, the game can crash even if the main mod is installed.",
      doNotDoYet: [
        "Do not delete your whole Mods folder.",
        "Do not reinstall the whole game first.",
        "Do not download files from random reupload sites.",
      ],
      stillCrashingNextSteps: [
        "Make sure the dependency version matches your game and loader version.",
        "Remove duplicate or old copies of the dependency if more than one exists.",
        "Run FixMyGame again with the newest log after testing.",
      ],
    };
  }

  if (category === "loader_mismatch") {
    return {
      whatThisMeans:
        "At least one mod, plugin, loader, or framework does not match the version of the game setup currently running.",
      whyFixMyGameThinksThis: [
        result.issue,
        result.mostLikelyCause,
        loader ? `The detected loader/system is ${loader}.` : "",
      ].filter(Boolean),
      beginnerExplanation:
        "A loader is what makes mods run. Mods usually have to match the correct game version and loader type.",
      doNotDoYet: [
        "Do not mix Forge-only mods with Fabric-only mods.",
        "Do not reinstall the whole game before checking versions.",
        "Do not change several mods at once.",
      ],
      stillCrashingNextSteps: [
        "Check the exact game version.",
        "Check the exact loader or framework version.",
        "Update or replace the mismatched mod, then test again.",
      ],
    };
  }

  if (category === "mod_conflict" || category === "mixin_failure") {
    return {
      whatThisMeans:
        "One mod appears to be breaking while the game is loading, or two mods may be trying to change the same part of the game.",
      whyFixMyGameThinksThis: [
        result.issue,
        result.mostLikelyCause,
        suspectedMods.length > 0
          ? `FixMyGame found these suspicious mod names: ${suspectText}.`
          : "",
      ].filter(Boolean),
      beginnerExplanation:
        "A mod conflict means the game may work normally until two mods try to control the same feature, file, class, or behavior.",
      doNotDoYet: [
        "Do not delete your saves.",
        "Do not remove a bunch of mods at once without a backup.",
        "Do not assume the base game is broken yet.",
      ],
      stillCrashingNextSteps: [
        "Disable the suspected mod first and test again.",
        "Update the suspected mod to the correct version.",
        "Re-enable mods one at a time until the crash returns.",
      ],
    };
  }

  if (category === "game_files_corrupt") {
    return {
      whatThisMeans:
        "The log points more toward missing or damaged base game files than toward one specific mod.",
      whyFixMyGameThinksThis: [
        result.issue,
        result.mostLikelyCause,
      ].filter(Boolean),
      beginnerExplanation:
        "Base game files are the original files installed by Steam or the game launcher. Mods rely on those files being present.",
      doNotDoYet: [
        "Do not delete your saves.",
        "Do not delete your whole Mods folder first.",
        "Do not reinstall before trying file verification.",
      ],
      stillCrashingNextSteps: [
        "Verify the game files through the launcher.",
        "Launch the game again after verification finishes.",
        "Load the newest log if it still crashes.",
      ],
    };
  }

  return {
    whatThisMeans:
      "FixMyGame found useful signals, but the log does not fully prove one single cause yet.",
    whyFixMyGameThinksThis: [
      result.issue,
      result.mostLikelyCause,
      errorType ? `The log includes ${errorType}.` : "",
    ].filter(Boolean),
    beginnerExplanation:
      "Some logs do not show one clear cause. The safest fix is to make one small change, test, then continue with a fresh log.",
    doNotDoYet: [
      "Do not delete saves.",
      "Do not reinstall the whole game yet.",
      "Do not change many things at once.",
    ],
    stillCrashingNextSteps: [
      "Run the game again and reproduce the issue.",
      "Load the newest log created after the crash.",
      "Use Continue Diagnostic so FixMyGame can compare the next log.",
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const appVersion = req.headers.get("x-fmg-app-version")?.trim() || "";
    const buildChannel = req.headers.get("x-fmg-build-channel")?.trim() || "unknown";

    if (!appVersion || isVersionBelow(appVersion, MIN_SUPPORTED_BETA_VERSION)) {
      return jsonResponse(
        {
          error: `This beta version is no longer supported. Please download FixMyGame v${MIN_SUPPORTED_BETA_VERSION} from the official beta-download channel or approved Google Drive folder.`,
          code: "unsupported_app_version",
          currentVersion: appVersion || "unknown",
          minimumVersion: MIN_SUPPORTED_BETA_VERSION,
          buildChannel,
        },
        426,
      );
    }

    let isBetaOpen = true;
    let isPro = req.cookies.get("fmg_pro")?.value === "1";
    let count = 0;

    try {
      const redis = await getRedis();
      const betaValue = await Promise.race([
        redis.get("beta:open"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Redis beta check timed out")), 1500),
        ),
      ]);

      isBetaOpen = String(betaValue) === "1";
    } catch (error) {
      console.error("Redis beta check failed open:", error);
      isBetaOpen = true;
    }

    try {
      const redisPro = await Promise.race([
        isProUser(req),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
      ]);

      isPro = isPro || Boolean(redisPro);
    } catch (error) {
      console.error("Redis pro check failed:", error);
    }

    if (!isBetaOpen && !isPro) {
      try {
        count = await Promise.race([
          incrementAndGetCount(req),
          new Promise<number>((resolve) => setTimeout(() => resolve(0), 1500)),
        ]);
      } catch (error) {
        console.error("Redis limit check failed open:", error);
        count = 0;
      }

      if (count > DAILY_LIMIT) {
        return jsonResponse(
          { error: "Daily limit reached.", remaining: 0, isPro: false, isBeta: false },
          429
        );
      }
    }

    const body = await req.json();
    const {
      crashLog,
      gameKey,
      gameTitle,
      gpuModel,
      driverVersion,
      graphicsApiMode,
      mostSuspiciousLine,
      quickSignals,
      logHighlights,
      liveMods,
      currentLogPath,
      continuedDiagnostic,
      resultRefinement,
    } = body ?? {};

    const forcedStardewEmptyFolderAdvisory =
  gameKey === "stardew_valley"
    ? detectForcedStardewEmptyFolderAdvisory({
        crashLog: typeof crashLog === "string" ? crashLog : "",
        quickSignals: quickSignals || null,
        logHighlights: Array.isArray(logHighlights) ? logHighlights : [],
        liveMods: Array.isArray(liveMods) ? liveMods : [],
      })
    : null;

    if (!crashLog || typeof crashLog !== "string" || !crashLog.trim()) {
      const remainingInfo = await getRemaining(req);
      return jsonResponse(
  { error: "No crash log provided.", ...remainingInfo },
  400
);
    }

const safeGameKey = typeof gameKey === "string" ? gameKey : "";
const safeGameTitle = typeof gameTitle === "string" ? gameTitle : "Unknown Game";

const relevantCrashLog = getRelevantLogWindow(crashLog, safeGameKey);

const crashEvidence = extractCrashEvidence(relevantCrashLog);
const evidencePolicy = buildEvidencePolicy(crashEvidence);
const healthyLogDetected = isHealthyLog(relevantCrashLog, safeGameKey);
const normalizedRelevantCrashLog = buildSessionFingerprint(relevantCrashLog);const previousRelevantCrashLog =
  typeof continuedDiagnostic?.previousRelevantLog === "string"
    ? normalizeLogForComparison(continuedDiagnostic.previousRelevantLog)
    : "";

const noNewLogAdded =
  !!previousRelevantCrashLog &&
  previousRelevantCrashLog === normalizedRelevantCrashLog;

let forcedSuspiciousMod = "";

if (typeof mostSuspiciousLine === "string") {
  const line = mostSuspiciousLine.toLowerCase();

  if (line.includes("mezz/jei") || line.includes("jei/")) {
    forcedSuspiciousMod = "jei";
  } else if (line.includes("fabric-api") || line.includes("fabric_api")) {
    forcedSuspiciousMod = "fabric-api";
  } else if (line.includes("sodium")) {
    forcedSuspiciousMod = "sodium";
  } else if (line.includes("iris")) {
    forcedSuspiciousMod = "iris";
  } else if (line.includes("optifine")) {
    forcedSuspiciousMod = "optifine";
  }
}

const gameSpecificPrompt = getGameSpecificPrompt(safeGameKey, safeGameTitle);

const refinementSection =
  resultRefinement?.userMessage?.trim()
    ? `
USER FOLLOW-UP:
Mode: ${resultRefinement.mode || "unknown"}
User says: ${resultRefinement.userMessage.trim()}

This follow-up is important.
Do not ignore it.

If the log shows a non-fatal warning or advisory issue, reflect that clearly instead of calling the log fully normal.
If the user says the issue is still happening, adapt the diagnosis and next steps to that context.
If the user clarifies that the issue is only a warning and not a crash, lower the severity and explain that clearly.
If the same warning may still be present because the user is looking at an older log, say so explicitly and tell them to relaunch the game and load the newest log created after testing the fix.

Return a cleaner, more adaptive diagnosis than the previous run.
`
    : "";

    const structuredSignalsSection = `
STRUCTURED SIGNALS FROM FIXMYGAME:
- Game key: ${safeGameKey || "unknown"}
- Game title: ${safeGameTitle || "unknown"}
- GPU model: ${typeof gpuModel === "string" ? gpuModel : "unknown"}
- Driver version: ${typeof driverVersion === "string" ? driverVersion : "unknown"}
- Graphics API mode: ${typeof graphicsApiMode === "string" ? graphicsApiMode : "unknown"}
- Current log path: ${typeof currentLogPath === "string" && currentLogPath.trim() ? currentLogPath : "unknown"}
- Most suspicious line: ${typeof mostSuspiciousLine === "string" && mostSuspiciousLine.trim() ? mostSuspiciousLine : "none"}
- Quick signals: ${JSON.stringify(quickSignals || {})}
- Log highlights: ${JSON.stringify(Array.isArray(logHighlights) ? logHighlights : [])}
- Live mods detected: ${JSON.stringify(Array.isArray(liveMods) ? liveMods : [])}
- Continued diagnostic context: ${JSON.stringify(continuedDiagnostic || null)}

How to use these structured signals:
- Use them before relying only on the raw log text.
- If these signals show a warning, skipped mod, empty folder, missing dependency, or partial load, do NOT call the log fully normal.
- If the game is unsupported/custom, still return a clean and useful diagnosis.
- If the issue is advisory rather than a crash, say that clearly.
- Prefer very simple user-facing language.
`;

const prompt = `
${gameSpecificPrompt}

${structuredSignalsSection}

${refinementSection}

You are an advanced crash diagnostic engine specialized in modded PC games.

Writing Style Rules:
- The "issue" field must be written in clear, natural, human-friendly language.
- Explain the problem simply using cause-and-effect.
- Avoid robotic or technical phrasing like "due to the presence of".
- Do NOT start with words like "Skipped", "Detected", or "Failure".
- Keep it to ONE sentence.
- Make it sound like something you would say to a user, not a developer.

Good example:
"A non-mod installer folder is in your Mods folder, so the game is skipping it."

Bad example:
"Skipped mods due to the presence of a non-mod installer in the Mods directory."

Wording Preferences:
- Use "Mods folder" instead of "Mods directory"
- Use "Delete" instead of "Remove" when referring to files/folders

Decision Rules:
- Distinguish clearly between:
  1. active crash
  2. advisory / warning
  3. missing dependency
  4. version mismatch
  5. invalid or empty mod folder
  6. partial mod/plugin load
  7. healthy / normal log
- If the log is healthy but the user follow-up says they still have a problem, acknowledge that the current log may be the wrong log or an older log.
- If the issue is only a warning and not a crash, lower severity and explain that clearly.
- If the same warning could still be visible because the user loaded an older log, say that explicitly.
- If the result is uncertain, still give the best simple next step instead of being vague.
- Never leave any field blank.
- For unsupported/custom games, still provide a clean diagnosis with the most likely cause and the next best action.

Analyze the crash log and return STRICT JSON only.
Do not return markdown.
Do not wrap the JSON in code fences.

Expected JSON shape:
{
  "quickFixFirst": "string",
  "issue": "string",
  "confidenceLevel": "Low | Medium | High",
  "probabilityBreakdown": ["string", "string"],
  "mostLikelyCause": "string",
  "recommendedFixSteps": ["string", "string"],
  "needMoreInfo": "string",
"explanation": {
  "whatThisMeans": "string",
  "whyFixMyGameThinksThis": ["string", "string"],
  "beginnerExplanation": "string",
  "doNotDoYet": ["string", "string"],
  "stillCrashingNextSteps": ["string", "string"]
},
"detectedSignals": {
    "errorType": "string",
    "loader": "string",
    "gameVersion": "string",
    "javaVersion": "string",
    "suspectedMods": ["string"],
    "likelyCategory": "mod_conflict | missing_dependency | dependency_not_initialized | loader_mismatch | mixin_failure | gpu_driver_issue | out_of_memory | shader_crash | java_mismatch | no_clear_issue_found | unknown",
    "dependencyState": "missing_not_installed | installed_but_not_loaded | installed_but_wrong_version | installed_but_corrupted | unknown_dependency_state",
    "missingComponentRaw": "string",
    "missingComponentDisplay": "string",
    "recommendedAction": "install | relaunch | update_or_match_version | reinstall | inspect"
  }
}

Rules:
- Prioritize mod conflict analysis over hardware causes when the log suggests mod issues.
- suspectedMods should be short names only.
- probabilityBreakdown should communicate relative likelihood without pretending the percentages are statistically measured.
- Prefer labels such as "Most likely", "Possible", and "Less likely" when exact probabilities are not supported by deterministic evidence.
- Do not invent secondary causes just to fill out the probability breakdown.
- Use numeric percentages only when FixMyGame's deterministic evidence clearly proves or explicitly quantifies the condition.
- Do not use 100% merely because one explanation seems more plausible than the others.
- recommendedFixSteps should be practical.
- If the log shows a normal startup or does not contain a clear crash, missing dependency, or mod failure, DO NOT invent an issue.
- In that case, return a result indicating "no clear issue found in this log".
- Explain that the user may need to load a newer crash log captured after the issue happens.
- If previous diagnostic context is provided, compare the new log against the previous issue.
- State clearly whether the previous issue appears resolved, unchanged, replaced by a new issue, or not visible in the newest log.
- Do not keep blaming an old issue if it no longer appears in the newest log.
- If previous diagnostic context is provided, compare the newest log against the previous result.
- State clearly whether the previous issue appears resolved, unchanged, replaced by a new issue, or not visible in the newest log.
- If the newest log is healthy and the previous diagnostic was also healthy, say that the result remains stable across both diagnostics.
- If the newest log is healthy but the previous diagnostic showed an issue, say that the previous issue is not visible in the newest log and may be resolved.
- explanation.whatThisMeans should explain the result in plain English.
- explanation.whyFixMyGameThinksThis should list the evidence from the log or structured signals.
- explanation.beginnerExplanation should define any technical term a beginner might not know.
- explanation.doNotDoYet should warn against risky panic steps like deleting all mods, reinstalling the whole game, or downloading random files.
- explanation.stillCrashingNextSteps should tell the user what to do if the first fix does not work.
- Keep explanation fields short, practical, and beginner-friendly.

Answer Quality Rules:
- When giving Minecraft dependency steps, include both the Minecraft version and loader when known.
- If Forge is detected, say "Forge version" instead of only saying "Minecraft version".
- If Fabric is detected, say "Fabric version" instead of only saying "Minecraft version".
- For Minecraft dependency fixes, recommendedFixSteps should avoid vague wording like "correct version" unless it also says the exact game version and loader.
- Be specific. Do not say vague things like "the error message indicates..." if the actual class, mod, file, or line is known.
- Use the exact evidence from the log when available.
- explanation.whyFixMyGameThinksThis must mention at least one concrete log signal, such as an exception name, class name, mod name, missing file, loader, or suspicious line.
- If the log contains a class path like mezz.jei.api.runtime.IJeiRuntime, explain what it points to in beginner language.
- Do not over-explain. Each field should be useful, short, and direct.
- Do not sound corporate, robotic, or like a developer console.
- Do not say "may be" or "could be" when the log clearly proves the issue.
- Do not invent uncertainty just to sound careful.
- If confidence is High, use confident wording.
- If confidence is Low or Medium, explain exactly what is missing.
- The best answer should tell the user:
  1. what broke,
  2. why FixMyGame thinks that,
  3. what to do first,
  4. what not to do yet,
  5. what to try if the first fix does not work.
- For Minecraft java_mismatch results, name the exact Java version needed when the Minecraft version is known.
- For Minecraft 1.18+ on Forge/Fabric/Quilt, prefer Java 17 unless the log clearly says a different version is required.
- Do not say only "update Java" when the log provides Minecraft version, loader, or current Java version.
- Better: "Install/select Java 17 for Minecraft 1.20.1 and Forge 47.2.0."

Better wording examples:
Bad: "The error message indicates a missing class related to the JEI mod."
Good: "The log says ClassNotFoundException for mezz.jei.api.runtime.IJeiRuntime, which is part of JEI."

Bad: "Install the required dependency."
Good: "Install Just Enough Items (JEI) for Minecraft 1.20.1 and Forge 47.2.0."

Bad: "Ensure all mods are compatible."
Good: "Make sure the JEI version matches Minecraft 1.20.1 and Forge, not Fabric."

Bad: "A dependency is missing."
Good: "ExampleMod is trying to call JEI, but JEI is not installed in the Mods folder."

Bad: "Download and install the correct version of JEI for Minecraft 1.20.1."
Good: "Download and install the Forge version of Just Enough Items (JEI) for Minecraft 1.20.1."

Bad: "Make sure all mods are compatible."
Good: "Make sure JEI, ExampleMod, and Forge all match Minecraft 1.20.1."

Evidence Safety Policy:
- Maximum allowed confidence: ${evidencePolicy.maxConfidence}
- Named individual culprit allowed: ${evidencePolicy.allowNamedCulprit ? "YES" : "NO"}
- Automatic repair recommendation allowed: ${evidencePolicy.allowAutomaticRepair ? "YES" : "NO"}
- Reason: ${evidencePolicy.evidenceReason}

Mandatory Evidence Rules:
- Never exceed the maximum allowed confidence above.
- If named individual culprit allowed is NO, do not claim that one specific mod, plugin, DLL, framework, or crash logger caused the crash.
- A plugin appearing only in a loaded-plugin list, load order, SKSE/F4SE/SFSE plugin inventory, or general module list is NOT proof that it caused the crash.
- A crash logger appearing in its own report is not causal evidence by itself.
- If the evidence is insufficient to isolate one culprit, say so directly.
- Do not convert presence in the report into causation.
- Do not recommend removing or quarantining a specific plugin unless the evidence actually supports that plugin as a suspect.

Context:
Game: ${safeGameTitle}
Game Key: ${safeGameKey}
GPU: ${gpuModel ?? ""}
Driver Version: ${driverVersion ?? ""}
Graphics API Mode: ${graphicsApiMode ?? ""}
Most Suspicious Line: ${typeof mostSuspiciousLine === "string" ? mostSuspiciousLine : ""}
Forced Suspicious Mod: ${forcedSuspiciousMod}

Priority Rules:
- The "Most Suspicious Line" must heavily influence your diagnosis.
- If "Forced Suspicious Mod" is provided AND the Evidence Safety Policy allows a named individual culprit, treat it as the primary suspect.
- Never allow a forced suspicious mod to override an Evidence Safety Policy that forbids naming an individual culprit.
- If the forced mod references missing classes, treat it as missing dependency or version mismatch.
- If a class path, package path, mod id, jar name, or namespace appears in the suspicious line, identify the most likely mod tied to it.
- Prefer naming the exact mod over giving only a generic "mod conflict" answer.
- If the suspicious line clearly points to a missing class, missing dependency, or incompatible mod, say that directly.
- Do not ignore the suspicious line just because the full log is long.
- If JEI, Fabric API, Forge, Quilt, SKSE, F4SE, MCCC, WickedWhims, Basemental, XML Injector, Address Library, Buffout, or similar major frameworks are referenced, call them out by name when relevant.

Previous Diagnostic Context:
${
  continuedDiagnostic
    ? JSON.stringify(continuedDiagnostic, null, 2)
    : "None"
}

${refinementSection}

Crash Log:
${relevantCrashLog}
`;

let parsed: AnalyzeModelResponse;

const hasRefinementNote =
  typeof resultRefinement?.userMessage === "string" &&
  resultRefinement.userMessage.trim().length > 0;

  const hasStructuredWarningSignals =
  Boolean(quickSignals?.issue) ||
  Boolean(quickSignals?.error) ||
  Boolean(mostSuspiciousLine) ||
  (Array.isArray(logHighlights) && logHighlights.length > 0) ||
  (Array.isArray(liveMods) && liveMods.length > 0);

const shouldUseAiEvenIfHealthy =
  hasRefinementNote ||
  safeGameKey === "custom" ||
  hasStructuredWarningSignals;

  if (forcedStardewEmptyFolderAdvisory) {
  parsed = forcedStardewEmptyFolderAdvisory;
} else

if (healthyLogDetected) {
  if (noNewLogAdded) {
    parsed = {
      quickFixFirst:
        "This appears to be the same log as your previous diagnostic. Load a newer log before continuing.",

      issue:
        "No new log was provided for continuation analysis.",

      confidenceLevel: "High",

      probabilityBreakdown: [
        "100% - Same log reused from previous diagnostic",
      ],

      mostLikelyCause:
        "The system detected that the relevant portion of this log is identical to the previous one.",

      recommendedFixSteps: [
        "Launch the game again and reproduce the issue or test changes.",
        "Load the newest crash or SMAPI log after that session.",
        "Run FixMyGame again with the updated log.",
      ],

      needMoreInfo:
        "A new log is required before FixMyGame can compare changes between runs.",

      detectedSignals: {
        suspectedMods: [],
        likelyCategory: "no_new_log",
      },
    };
  } else if (shouldUseAiEvenIfHealthy) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content ?? "";
      parsed = JSON.parse(content);
    } catch {
      parsed = fallbackAnalyze(
        relevantCrashLog,
        safeGameKey,
        safeGameTitle,
        continuedDiagnostic
      );
    }
  } else {
    parsed = fallbackAnalyze(
      relevantCrashLog,
      safeGameKey,
      safeGameTitle,
      continuedDiagnostic
    );
  }
} else {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    parsed = JSON.parse(content) as AnalyzeModelResponse;
  } catch {
    parsed = fallbackAnalyze(relevantCrashLog, safeGameKey, safeGameTitle, continuedDiagnostic);
  }
}

    const normalized: AnalyzeModelResponse = {
      quickFixFirst: parsed.quickFixFirst || "Temporarily remove the suspected mod and retry launch.",
      issue: parsed.issue || "Unable to determine issue precisely from the crash log.",
      confidenceLevel:
        parsed.confidenceLevel === "Low" ||
        parsed.confidenceLevel === "Medium" ||
        parsed.confidenceLevel === "High"
          ? parsed.confidenceLevel
          : "Medium",
      probabilityBreakdown:
  Array.isArray(parsed.probabilityBreakdown) && parsed.probabilityBreakdown.length > 0
    ? parsed.probabilityBreakdown
    : ["Uncertain - The available log evidence does not support a precise probability."],
      mostLikelyCause:
        parsed.mostLikelyCause ||
        "A mod conflict, missing dependency, or loader mismatch is likely.",
      recommendedFixSteps:
        Array.isArray(parsed.recommendedFixSteps) && parsed.recommendedFixSteps.length > 0
          ? parsed.recommendedFixSteps
          : ["Review the crash log and remove the most recently added mod."],
      needMoreInfo:
  parsed.needMoreInfo ||
  (parsed.detectedSignals?.likelyCategory === "advisory_empty_folder"
    ? "If the same warning still appears after cleanup, launch the game again and load the newest SMAPI log."
    : "If the issue continues, provide a newer crash log after the problem happens."),

explanation:
  parsed.explanation && typeof parsed.explanation === "object"
    ? {
        whatThisMeans:
          typeof parsed.explanation.whatThisMeans === "string"
            ? parsed.explanation.whatThisMeans
            : "",
        whyFixMyGameThinksThis:
          Array.isArray(parsed.explanation.whyFixMyGameThinksThis)
            ? parsed.explanation.whyFixMyGameThinksThis.filter(
                (item: unknown) =>
                  typeof item === "string" && item.trim().length > 0
              )
            : [],
        beginnerExplanation:
          typeof parsed.explanation.beginnerExplanation === "string"
            ? parsed.explanation.beginnerExplanation
            : "",
        doNotDoYet:
          Array.isArray(parsed.explanation.doNotDoYet)
            ? parsed.explanation.doNotDoYet.filter(
                (item: unknown) =>
                  typeof item === "string" && item.trim().length > 0
              )
            : [],
        stillCrashingNextSteps:
          Array.isArray(parsed.explanation.stillCrashingNextSteps)
            ? parsed.explanation.stillCrashingNextSteps.filter(
                (item: unknown) =>
                  typeof item === "string" && item.trim().length > 0
              )
            : [],
      }
    : undefined,

detectedSignals: {
  errorType: parsed.detectedSignals?.errorType || "",
  loader: parsed.detectedSignals?.loader || "",
  gameVersion: parsed.detectedSignals?.gameVersion || "",
  javaVersion: parsed.detectedSignals?.javaVersion || "",
  suspectedMods: Array.isArray(parsed.detectedSignals?.suspectedMods)
    ? parsed.detectedSignals.suspectedMods.filter(Boolean)
    : [],
  likelyCategory: parsed.detectedSignals?.likelyCategory || "unknown",
  dependencyState: parsed.detectedSignals?.dependencyState,
  missingComponentRaw: parsed.detectedSignals?.missingComponentRaw,
  missingComponentDisplay: parsed.detectedSignals?.missingComponentDisplay,
  recommendedAction: parsed.detectedSignals?.recommendedAction,
},
    };
    const evidenceValidatedNormalized = enforceEvidencePolicy(
  normalized,
  evidencePolicy,
);
    const finalRelevantLog = crashLog || "";

    const finalIsStardewAdvisoryOnlyLog =
  safeGameKey === "stardew_valley" &&
  finalRelevantLog.includes("Mods loaded and ready!") &&
  finalRelevantLog.includes("None found!") &&
  !finalRelevantLog.includes("ContentLoadException") &&
  !finalRelevantLog.includes("FileNotFoundException") &&
  !finalRelevantLog.includes("ClassNotFoundException") &&
  !finalRelevantLog.includes("NoClassDefFoundError") &&
  !finalRelevantLog.includes("Unhandled exception") &&
  !finalRelevantLog.includes("The game failed to launch");

const finalIsMissingBaseGameFile =
  finalRelevantLog.includes("ContentLoadException") &&
  (finalRelevantLog.includes(".xnb") || finalRelevantLog.includes(".xgs"));

const correctedNormalized: AnalyzeModelResponse = finalIsMissingBaseGameFile
  ? {
      ...evidenceValidatedNormalized,
      quickFixFirst: "Verify Stardew Valley’s game files through Steam.",
      issue:
        "The game is missing or unable to load required base game files, so it cannot finish launching.",
      confidenceLevel: "High",
      probabilityBreakdown: ["100% - Missing or corrupted base game files"],
      mostLikelyCause:
        "A required Stardew Valley Content file, such as an .xnb or .xgs asset, is missing or corrupted.",
      recommendedFixSteps: [
        "Open Steam.",
        "Right-click Stardew Valley.",
        "Choose Properties.",
        "Go to Installed Files.",
        "Click Verify integrity of game files.",
        "After Steam finishes repairing files, launch Stardew Valley again.",
      ],
      needMoreInfo:
        "If verifying files does not fix it, reinstall Stardew Valley or provide the newest SMAPI log after the next failed launch.",
      detectedSignals: {
        ...normalized.detectedSignals,
        errorType: "ContentLoadException",
        loader: "SMAPI",
        suspectedMods: [],
        likelyCategory: "game_files_corrupt",
        dependencyState: undefined,
        missingComponentRaw: undefined,
        missingComponentDisplay: undefined,
        recommendedAction: undefined,
      },
    }
  : finalIsStardewAdvisoryOnlyLog
  ? {
      ...evidenceValidatedNormalized,
      quickFixFirst: "No fix needed yet — this Stardew Valley log looks healthy.",
      issue:
        "SMAPI loaded the mods successfully and did not find a real crash, missing dependency, or software conflict.",
      confidenceLevel: "High",
      probabilityBreakdown: ["100% - No active crash found in this log"],
      mostLikelyCause:
        "The warnings shown are normal SMAPI advisory notes about mods that patch game code, not confirmed crash causes.",
      recommendedFixSteps: [
        "Launch Stardew Valley and test normally.",
        "Only remove mods if the game actually crashes or has a visible issue.",
        "If a crash happens, load the newest SMAPI log created after that crash.",
      ],
      needMoreInfo:
        "No more info is needed unless the game crashes or behaves incorrectly after this log.",
      detectedSignals: {
        ...normalized.detectedSignals,
        errorType: "",
        loader: "SMAPI",
        suspectedMods: [],
        likelyCategory: "no_clear_issue_found",
        dependencyState: undefined,
        missingComponentRaw: undefined,
        missingComponentDisplay: undefined,
        recommendedAction: undefined,
      },
    }
  : evidenceValidatedNormalized;
  const finalNormalized =
  correctedNormalized.detectedSignals?.likelyCategory === "advisory_empty_folder" ||
  correctedNormalized.detectedSignals?.likelyCategory === "game_files_corrupt" ||
  correctedNormalized.detectedSignals?.likelyCategory === "no_clear_issue_found" ||
  !evidencePolicy.allowNamedCulprit
    ? correctedNormalized
    : applyForcedSuspiciousMod(
        correctedNormalized,
        forcedSuspiciousMod,
        typeof mostSuspiciousLine === "string" ? mostSuspiciousLine : ""
      );

   const finalWithExplanation: AnalyzeModelResponse = {
  ...finalNormalized,
  explanation:
    finalNormalized.explanation &&
    (
      finalNormalized.explanation.whatThisMeans ||
      finalNormalized.explanation.whyFixMyGameThinksThis?.length ||
      finalNormalized.explanation.beginnerExplanation ||
      finalNormalized.explanation.doNotDoYet?.length ||
      finalNormalized.explanation.stillCrashingNextSteps?.length
    )
      ? finalNormalized.explanation
      : buildDefaultExplanation(finalNormalized),
};

const result = formatPlainText(finalWithExplanation);

const res = jsonResponse({
  result,
  analysis: finalWithExplanation,
  detectedSignals: finalWithExplanation.detectedSignals,
  isPro,
  remaining: isPro ? Infinity : Math.max(0, DAILY_LIMIT - count),
});

    if (!req.cookies.get("vid")) {
      res.cookies.set("vid", crypto.randomUUID(), {
  httpOnly: false,
  sameSite: "lax",
  secure: false,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
});
    }

    return res;
  } catch (error) {
    console.error(error);
    return jsonResponse(
  { error: "Internal server error." },
  500
);
  }
}