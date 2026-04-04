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

function fallbackAnalyze(crashLog: string, gameKey = "", gameTitle = "Unknown Game"): AnalyzeModelResponse {
  const lower = crashLog.toLowerCase();
  const normalizedGameKey = typeof gameKey === "string" ? gameKey : "";
  const normalizedGameTitle = typeof gameTitle === "string" ? gameTitle : "Unknown Game";
  
  const suspectedMods: string[] = [];

  if (typeof crashLog === "string" && crashLog.toLowerCase().includes("mezz/jei")) {
  if (!suspectedMods.includes("jei")) {
    suspectedMods.unshift("jei"); // force it to be FIRST
  }
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
    } = body ?? {};

    if (!crashLog || typeof crashLog !== "string" || !crashLog.trim()) {
      const remainingInfo = await getRemaining(req);
      return jsonResponse(
  { error: "No crash log provided.", ...remainingInfo },
  400
);
    }

const safeGameKey = typeof gameKey === "string" ? gameKey : "";
const safeGameTitle = typeof gameTitle === "string" ? gameTitle : "Unknown Game";

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

const prompt = `
${gameSpecificPrompt}

You are an advanced crash diagnostic engine specialized in modded PC games.

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
    "likelyCategory": "mod_conflict | missing_dependency | loader_mismatch | mixin_failure | gpu_driver_issue | out_of_memory | shader_crash | java_mismatch | unknown"
  }
}

Rules:
- Prioritize mod conflict analysis over hardware causes when the log suggests mod issues.
- suspectedMods should be short names only.
- probabilityBreakdown entries should total 100%.
- recommendedFixSteps should be practical.

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

Crash Log:
${crashLog}
`;

    let parsed: AnalyzeModelResponse;

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
      parsed = fallbackAnalyze(crashLog, safeGameKey, safeGameTitle);
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
        "Provide the full crash report and complete mod list for more accuracy.",
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
    const finalNormalized = applyForcedSuspiciousMod(
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