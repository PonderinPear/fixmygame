import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { isProUser } from "@/lib/pro";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-fmg-device-id",
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

type DetectedSignals = {
  errorType?: string;
  loader?: string;
  gameVersion?: string;
  javaVersion?: string;
  suspectedMods: string[];
    likelyCategory?:
    | "mod_conflict"
    | "missing_dependency"
    | "loader_mismatch"
    | "mixin_failure"
    | "gpu_driver_issue"
    | "out_of_memory"
    | "shader_crash"
    | "java_mismatch"
    | "no_clear_issue_found"
    | "no_new_log"
    | "advisory_skipped_mod"
    | "advisory_empty_folder"
    | "advisory_optional_dependency"
    | "advisory_workshop_warning"
    | "advisory_partial_load"
    | "unknown";
};

type AnalyzeModelResponse = {
  quickFixFirst: string;
  issue: string;
  confidenceLevel: "Low" | "Medium" | "High";
  probabilityBreakdown: string[];
  mostLikelyCause: string;
  recommendedFixSteps: string[];
  needMoreInfo: string;
  detectedSignals: DetectedSignals;
};

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

async function getRemaining(req: NextRequest) {
  const redisPro = await isProUser(req);
  const cookiePro = req.cookies.get("fmg_pro")?.value === "1";
  const isPro = redisPro || cookiePro;
  if (isPro) return { isPro: true, remaining: Infinity };

  const clientKey = getClientKey(req);
  const key = `limit:${today()}:${clientKey}`;

  const redis = await getRedis();
  const currentRaw = await redis.get(key);
  const current = currentRaw ? Number(currentRaw) : 0;

  const remaining = Math.max(0, DAILY_LIMIT - current);
  return { isPro: false, remaining };
}

async function incrementAndGetCount(req: NextRequest) {
  const clientKey = getClientKey(req);
  const key = `limit:${today()}:${clientKey}`;

  const redis = await getRedis();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60 * 60 * 48);
  }

  return count;
}

function getRelevantLogWindow(crashLog: string, gameKey = "") {
  const lines = crashLog.split("\n");

  if (gameKey === "stardew_valley") {
    // If the file contains multiple SMAPI sessions, prefer the latest one.
    const sessionStartIndexes: number[] = [];

    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      if (
        lower.includes("smapi 4.") ||
        lower.includes("log started at")
      ) {
        sessionStartIndexes.push(index);
      }
    });

    if (sessionStartIndexes.length > 1) {
      const lastStart = sessionStartIndexes[sessionStartIndexes.length - 1];
      return lines.slice(lastStart).join("\n");
    }

    // Otherwise just bias toward the tail of the current session.
    return lines.slice(-120).join("\n");
  }

  // Generic fallback: prefer the most recent portion of the log.
  return lines.slice(-160).join("\n");
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
let probabilityBreakdown = [
  "Mod conflict: 60%",
  "Version mismatch: 25%",
  "Missing dependency: 15%",
];
let recommendedFixSteps = [
  "Remove the most recently added or updated mod and test launch again.",
  "Check the mod's supported game and loader/plugin versions.",
  "Verify required dependencies are installed.",
  "Temporarily remove graphics or script/plugin-heavy mods if the issue persists.",
];

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
  probabilityBreakdown = [
    "Plugin conflict: 55%",
    "Address Library / SKSE mismatch: 30%",
    "Load order issue: 15%",
  ];
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
  const leadMod = suspectedMods[0] || "the affected mod";
  quickFixFirst = `Install the missing dependency for ${leadMod}, or remove ${leadMod}.`;
  issue = `A required dependency is missing for ${leadMod}.`;
    mostLikelyCause = "One or more mods require another mod or library that is not installed or is the wrong version.";
    probabilityBreakdown = [
      "Missing dependency: 80%",
      "Wrong dependency version: 15%",
      "Wrong loader build: 5%",
    ];
    recommendedFixSteps = [
      "Install the missing dependency listed in the crash log.",
      "Check that dependency versions match your Minecraft version.",
      "Make sure all mods are for the same loader.",
      "Remove the dependent mod if you do not want to install its requirement.",
    ];
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
    "Probability Breakdown (must total 100%):",
    ...result.probabilityBreakdown.map((line) => `- ${line.replace(/^-+\s*/, "")}`),
    `Most Likely Cause: ${result.mostLikelyCause}`,
    "Recommended Fix Steps:",
    ...result.recommendedFixSteps.map((step, i) => `${i + 1}. ${step}`),
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
  const suspiciousLineLower = (mostSuspiciousLine || "").toLowerCase();

  let likelyCategory = normalized.detectedSignals?.likelyCategory || "unknown";
  let quickFixFirst = normalized.quickFixFirst;
  let issue = normalized.issue;
  let mostLikelyCause = normalized.mostLikelyCause;
  let probabilityBreakdown = normalized.probabilityBreakdown;
  let recommendedFixSteps = normalized.recommendedFixSteps;
  let needMoreInfo = normalized.needMoreInfo;
  let errorType = normalized.detectedSignals?.errorType || "";

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

export async function POST(req: NextRequest) {
  try {
    const redisPro = await isProUser(req);
    const cookiePro = req.cookies.get("fmg_pro")?.value === "1";
    const isPro = redisPro || cookiePro;

    let count = 0;
    if (!isPro) {
      count = await incrementAndGetCount(req);
      if (count > DAILY_LIMIT) {
        return jsonResponse(
  { error: "Daily limit reached.", remaining: 0, isPro: false },
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
const healthyLogDetected = isHealthyLog(relevantCrashLog, safeGameKey);
const normalizedRelevantCrashLog = normalizeLogForComparison(relevantCrashLog);
const previousRelevantCrashLog =
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
  "detectedSignals": {
    "errorType": "string",
    "loader": "string",
    "gameVersion": "string",
    "javaVersion": "string",
    "suspectedMods": ["string"],
    "likelyCategory": "mod_conflict | missing_dependency | loader_mismatch | mixin_failure | gpu_driver_issue | out_of_memory | shader_crash | java_mismatch | no_clear_issue_found | unknown"
  }
}

Rules:
- Prioritize mod conflict analysis over hardware causes when the log suggests mod issues.
- suspectedMods should be short names only.
- probabilityBreakdown entries should total 100%.
- recommendedFixSteps should be practical.
- Do not invent secondary causes just to fill out the probability breakdown.
- If the crash log points to one clear issue, the probability breakdown should reflect that clearly.
- When only one issue is strongly supported, use a single 100% entry instead of adding weak extra possibilities.
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
- If "Forced Suspicious Mod" is provided, treat it as the PRIMARY failing mod.
- Do NOT override the forced mod with other mods unless clearly proven otherwise.
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
          : ["Unknown cause: 100%"],
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
  detectedSignals: {
  errorType: parsed.detectedSignals?.errorType || "",
  loader: parsed.detectedSignals?.loader || "",
  gameVersion: parsed.detectedSignals?.gameVersion || "",
  javaVersion: parsed.detectedSignals?.javaVersion || "",
  suspectedMods: Array.isArray(parsed.detectedSignals?.suspectedMods)
    ? parsed.detectedSignals.suspectedMods.filter(Boolean)
    : [],
  likelyCategory: parsed.detectedSignals?.likelyCategory || "unknown",
},
    };
    const finalNormalized =
  normalized.detectedSignals?.likelyCategory === "advisory_empty_folder"
    ? normalized
    : applyForcedSuspiciousMod(
        normalized,
        forcedSuspiciousMod,
        typeof mostSuspiciousLine === "string" ? mostSuspiciousLine : ""
      );

    const result = formatPlainText(finalNormalized);

const res = jsonResponse({
  result,
  analysis: finalNormalized,
  detectedSignals: finalNormalized.detectedSignals,
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