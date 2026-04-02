"use client";

import React, { useEffect, useMemo, useRef,  useState } from "react";

declare global {
  interface Window {
    fixMyGame?: {
      ping?: () => string;
      scanLogsForGame?: (gameKey: string) =>
  | Promise<{ name: string; fullPath: string; lastModified?: number; size?: number }[]>
  | { name: string; fullPath: string; lastModified?: number; size?: number }[];
      pickLogFile?: () => Promise<string | null>;
      pickScanFolder?: () => Promise<string | null>;
      scanCustomFolder?: (folderPath: string) => Promise<
  { name: string; fullPath: string; lastModified?: number; size?: number }[]
>;
      readLogFile?: (filePath: string) => Promise<string>;
      saveAnalysis?: (defaultPath: string, content: string) => Promise<{
        canceled?: boolean;
        ok?: boolean;
        path?: string;
        error?: string;
      }>;
openModsFolder?: (gameKey: string) => Promise<{
  ok?: boolean;
  path?: string;
  error?: string;
}>;
openLogsFolder?: (gameKey: string) => Promise<{
  ok?: boolean;
  path?: string;
  error?: string;
}>;
openFolderPath?: (targetPath: string) => Promise<{
  ok?: boolean;
  path?: string;
  error?: string;
}>;
    };
  }
}

type LimitResponse = {
  isPro: boolean;
  remaining: number;
  limit: number;
};

type AnalyzeResponse = {
  result: string;
  analysis?: {
    quickFixFirst: string;
    issue: string;
    confidenceLevel: "Low" | "Medium" | "High";
    probabilityBreakdown: string[];
    mostLikelyCause: string;
    recommendedFixSteps: string[];
    needMoreInfo: string;
    detectedSignals?: {
      errorType?: string;
      loader?: string;
      gameVersion?: string;
      javaVersion?: string;
      suspectedMods?: string[];
      likelyCategory?: string;
    };
  };
  detectedSignals?: {
    errorType?: string;
    loader?: string;
    gameVersion?: string;
    javaVersion?: string;
    suspectedMods?: string[];
    likelyCategory?: string;
  };
};

type CheckoutResponse = {
  url: string;
};

type ApiErrorShape = {
  error?: string;
  message?: string;
};

function isApiErrorShape(x: unknown): x is ApiErrorShape {
  return typeof x === "object" && x !== null;
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";

  let vid = window.localStorage.getItem("fmg_vid");

  if (!vid) {
    vid = crypto.randomUUID();
    window.localStorage.setItem("fmg_vid", vid);
  }

  return vid;
}

async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const deviceId = getOrCreateDeviceId();

  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-fmg-device-id": deviceId,
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();

  let parsed: unknown = null;
  if (text.trim().length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;

    if (isApiErrorShape(parsed)) {
      if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
        message = parsed.error;
      } else if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
        message = parsed.message;
      }
    } else if (text.trim().length > 0) {
      message = text.slice(0, 300);
    }

    throw new Error(message);
  }

  if (parsed === null) {
    throw new Error("Server returned an empty response.");
  }

  return parsed as T;
}

function getSmartFixPath(
  signals: AnalyzeResponse["detectedSignals"] | null,
  analysis: AnalyzeResponse["analysis"] | null,
  gameKey: string
) {
  const category = signals?.likelyCategory ?? "unknown";
  const loader = signals?.loader ?? "";
  const javaVersion = signals?.javaVersion ?? "";
  const mods = signals?.suspectedMods ?? [];

  // GAME-SPECIFIC HANDLING FIRST

if (gameKey === "sims4") {
  if (category === "gpu_driver_issue") {
    return {
      title: "Graphics / Driver Issue (Sims 4)",
      bullets: [
        "Lower graphics settings and disable overlays first.",
        "Update your GPU driver to the latest stable version.",
        "Temporarily remove shader, reshade, or graphics-related mods.",
        "Retest before re-enabling visual mods or custom content.",
      ],
    };
  }

  if (category === "out_of_memory") {
    return {
      title: "Memory Issue (Sims 4)",
      bullets: [
        "Temporarily remove large CC batches and test again.",
        "Close memory-heavy apps before launching the game.",
        "Test with script mods disabled first.",
        "Reintroduce CC and mods in smaller groups to isolate the problem.",
      ],
    };
  }

  return {
    title: "Script Mod / CC Issue (Sims 4)",
    bullets: [
      "Check for broken or outdated script mods (MCCC, WickedWhims, etc).",
      "Remove recently added CC or mods.",
      "Delete lastException files and relaunch.",
      "Update core mods to match your game version.",
    ],
  };
}

if (gameKey === "skyrimse") {
  if (category === "gpu_driver_issue") {
    return {
      title: "Graphics / Driver Issue (Skyrim)",
      bullets: [
        "Disable ENB, ReShade, or graphics-heavy mods first.",
        "Update your GPU driver to the latest stable version.",
        "Lower graphics settings and retest.",
        "Re-enable visual mods one at a time after stability returns.",
      ],
    };
  }

  if (category === "out_of_memory") {
    return {
      title: "Memory Issue (Skyrim)",
      bullets: [
        "Temporarily disable large texture packs and heavy world mods.",
        "Close memory-heavy apps before launching.",
        "Test with fewer active plugins and visual overhauls.",
        "Reintroduce mods in smaller groups until the issue returns.",
      ],
    };
  }

  return {
    title: "SKSE / Plugin Crash (Skyrim)",
    bullets: [
      "Update SKSE and all DLL-based mods.",
      "Check Address Library version compatibility.",
      "Disable recently installed plugins.",
      "Verify load order using your mod manager.",
    ],
  };
}

if (gameKey === "fallout4") {
  if (category === "gpu_driver_issue") {
    return {
      title: "Graphics / Driver Issue (Fallout 4)",
      bullets: [
        "Disable graphics-heavy mods, ENB, or ReShade first.",
        "Update your GPU driver to the latest stable version.",
        "Lower graphics settings and retest.",
        "Re-enable visual mods one at a time after confirming stability.",
      ],
    };
  }

  if (category === "out_of_memory") {
    return {
      title: "Memory Issue (Fallout 4)",
      bullets: [
        "Temporarily disable large texture packs and heavy overhaul mods.",
        "Close other memory-heavy apps before launching.",
        "Test with fewer active plugins first.",
        "Reintroduce mods gradually to find the unstable group.",
      ],
    };
  }

  return {
    title: "F4SE / Plugin Crash (Fallout 4)",
    bullets: [
      "Update F4SE and Buffout if installed.",
      "Check for outdated or broken plugins.",
      "Disable recent mods and test.",
      "Verify load order in your mod manager.",
    ],
  };
}

  switch (category) {
    case "java_mismatch":
      return {
        title: "Java version mismatch detected",
        bullets: [
          `Install Java 17 or the version required by your modpack.`,
          loader ? `Recheck your ${loader} launcher profile after updating Java.` : "Recheck your launcher profile after updating Java.",
          javaVersion ? `Current detected Java: ${javaVersion}` : "Your current Java version may be too old.",
          "Point the launcher to the new Java executable and relaunch.",
        ],
      };

    case "out_of_memory":
      return {
        title: "Out of memory crash detected",
        bullets: [
          "Increase allocated RAM in the launcher.",
          "Disable shaders and high-resolution resource packs.",
          "Temporarily remove large or performance-heavy mods.",
          "Close memory-heavy apps before relaunching the game.",
        ],
      };

    case "missing_dependency":
      return {
        title: "Missing dependency detected",
        bullets: [
          mods.length > 0
            ? `Check whether ${mods.join(", ")} requires another missing mod or library.`
            : "Check which dependency is missing from the crash log.",
          "Install the missing dependency version that matches your Minecraft version.",
          "Make sure all mods use the same loader.",
          "Relaunch after adding the missing library/mod.",
        ],
      };

    case "mixin_failure":
      return {
        title: "Mixin failure detected",
        bullets: [
          "Update the mod mentioned near the mixin error.",
          "Temporarily remove recently added core/optimization mods.",
          "Make sure all mods match your exact Minecraft version.",
          "Check whether two mods are patching the same game class.",
        ],
      };

    case "loader_mismatch":
      return {
        title: "Loader mismatch detected",
        bullets: [
          "Remove Fabric-only mods from Forge, or Forge-only mods from Fabric.",
          loader ? `Current loader detected: ${loader}.` : "Verify which loader your launcher is using.",
          "Redownload suspicious mods from the correct loader page.",
          "Retest with only one loader ecosystem installed.",
        ],
      };

    case "shader_crash":
      return {
        title: "Shader or rendering crash detected",
        bullets: [
          "Disable shaders first and relaunch.",
          "Temporarily remove OptiFine, Iris, Oculus, Sodium, or Rubidium one at a time.",
          "Lower graphics settings and test again.",
          "Update GPU drivers if the crash continues.",
        ],
      };

    case "gpu_driver_issue":
      return {
        title: "GPU or driver issue detected",
        bullets: [
          "Update your graphics driver to the latest stable version.",
          "Disable rendering mods and test again.",
          "Switch to default graphics settings.",
          "Restart the PC after driver updates before retesting.",
        ],
      };

    case "mod_conflict":
      return {
        title: "Mod conflict likely",
        bullets: [
  mods.length >= 2
    ? `Likely conflict between: ${mods[0]} ↔ ${mods[1]}`
    : mods.length === 1
    ? `Start by testing without ${mods[0]}.`
    : "Start by disabling the most recently added or updated mod.",
  "Re-enable mods one at a time until the crash returns.",
  "Check that all mods match your Minecraft and loader version.",
  "Watch for duplicate libraries or overlapping performance mods.",
],
      };

    default:
      return {
        title: "General fix path",
        bullets: [
          analysis?.quickFixFirst || "Start with the most likely fix from the analysis.",
          "Remove the most recently added or updated mod first.",
          gameKey === "minecraft"
            ? "Verify loader, Java, and Minecraft versions all match."
            : "Verify the game version, plugin/mod versions, and dependencies all match.",
          "Retest after each single change so you can isolate the issue.",
        ],
      };
      
  }
}

function formatCategoryLabel(category?: string, gameKey?: string) {
  if (!category) return "";

  if (gameKey === "sims4") {
    switch (category) {
      case "mod_conflict":
        return "Script Mod Conflict";
      case "missing_dependency":
        return "Missing Script Dependency";
      case "loader_mismatch":
        return "Wrong Mod Type";
      case "gpu_driver_issue":
        return "Graphics / Driver Issue";
      case "out_of_memory":
        return "Memory Issue";
      default:
        return category
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
    }
  }

  if (gameKey === "skyrimse") {
    switch (category) {
      case "mod_conflict":
        return "SKSE / Plugin Conflict";
      case "missing_dependency":
        return "Missing Plugin Requirement";
      case "loader_mismatch":
        return "Plugin Stack Mismatch";
      case "gpu_driver_issue":
        return "Graphics / Driver Issue";
      case "out_of_memory":
        return "Memory Issue";
      default:
        return category
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
    }
  }

  if (gameKey === "fallout4") {
    switch (category) {
      case "mod_conflict":
        return "F4SE / Plugin Conflict";
      case "missing_dependency":
        return "Missing Plugin Requirement";
      case "loader_mismatch":
        return "Plugin Stack Mismatch";
      case "gpu_driver_issue":
        return "Graphics / Driver Issue";
      case "out_of_memory":
        return "Memory Issue";
      default:
        return category
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
    }
  }

  switch (category) {
    case "java_mismatch":
      return "Java Mismatch";
    case "mod_conflict":
      return "Mod Conflict";
    case "missing_dependency":
      return "Missing Dependency";
    case "loader_mismatch":
      return "Loader Mismatch";
    case "mixin_failure":
      return "Mixin Failure";
    case "gpu_driver_issue":
      return "GPU / Driver Issue";
    case "shader_crash":
      return "Shader Crash";
    case "out_of_memory":
      return "Out of Memory";
    default:
      return category
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}

function formatLoaderLabel(loader?: string) {
  if (!loader) return "";

  if (loader.toLowerCase().includes("fabric")) return "Fabric";
  if (loader.toLowerCase().includes("forge")) return "Forge";
  if (loader.toLowerCase().includes("quilt")) return "Quilt";

  return loader;
}

function getLoaderLabelForGame(gameKey: string) {
  if (gameKey === "minecraft") return "Loader";
  if (gameKey === "sims4") return "Mod Type";
  if (gameKey === "skyrimse") return "Plugin Stack";
  if (gameKey === "fallout4") return "Plugin Stack";
  return "System";
}

function getVersionLabelForGame(gameKey: string) {
  if (gameKey === "minecraft") return "MC";
  if (gameKey === "sims4") return "Game";
  if (gameKey === "skyrimse") return "Game";
  if (gameKey === "fallout4") return "Game";
  return "Version";
}

function getJavaLabelForGame(gameKey: string) {
  if (gameKey === "minecraft") return "Java";
  return "";
}

function getTopFeaturePills(gameKey: string) {
  if (gameKey === "minecraft") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "Loader / Dependency Detection",
      "Smart Fix Paths",
    ];
  }

  if (gameKey === "sims4") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "Script Mod / CC Detection",
      "Smart Fix Paths",
    ];
  }

  if (gameKey === "skyrimse") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "SKSE / Plugin Detection",
      "Smart Fix Paths",
    ];
  }

  if (gameKey === "fallout4") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "F4SE / Plugin Detection",
      "Smart Fix Paths",
    ];
  }

  return [
    "Desktop Scanner",
    "AI Diagnostic Engine",
    "Mod / Plugin Detection",
    "Smart Fix Paths",
  ];
}

function quickDetect(log: string, gameKey: string) {
  const lower = log.toLowerCase();

  if (gameKey === "minecraft") {
    const loader =
      lower.includes("fabric") ? "Fabric" :
      lower.includes("forge") ? "Forge" :
      lower.includes("quilt") ? "Quilt" :
      null;

    const java =
      log.match(/java version[:\s]+([^\n]+)/i)?.[1]?.trim() ||
      log.match(/java[:\s]+([0-9][^\n]*)/i)?.[1]?.trim() ||
      null;

    const rawError =
      log.match(/([A-Za-z0-9_.]*(Exception|Error))(?::\s*[^\n]*)?/i)?.[1]?.trim() ||
      null;

    const error =
      rawError?.toLowerCase() === "error"
        ? "UnknownError"
        : rawError;

    return {
      loader,
      java,
      error,
    };
  }

  if (gameKey === "sims4") {
    const error =
      log.match(/(lastexception|exception|script call failed|tunableperf|mccc)/i)?.[1] ||
      null;

    return {
      loader: "Script Mods / CC",
      java: null,
      error,
    };
  }

  if (gameKey === "skyrimse") {
    const error =
      log.match(/(skse|exception|crash|dll plugin|address library)/i)?.[1] ||
      null;

    return {
      loader: "SKSE / Mod Manager",
      java: null,
      error,
    };
  }

  if (gameKey === "fallout4") {
    const error =
      log.match(/(f4se|exception|crash|dll plugin|buffout)/i)?.[1] ||
      null;

    return {
      loader: "F4SE / Mod Manager",
      java: null,
      error,
    };
  }

  const rawError =
    log.match(/([A-Za-z0-9_.]*(Exception|Error))(?::\s*[^\n]*)?/i)?.[1]?.trim() ||
    log.match(/(crash|error|failed)/i)?.[1] ||
    null;

  return {
    loader: null,
    java: null,
    error: rawError?.toLowerCase() === "error" ? "UnknownError" : rawError,
  };
}

function formatProbabilityItem(item: string, index: number) {
  const percentMatch = item.match(/\d+/);
  const percent = percentMatch ? Number(percentMatch[0]) : 50;

  const cleaned = item.trim();

  if (cleaned.includes("-")) {
    return {
      label: cleaned,
      percent,
    };
  }

  const fallbackLabels = [
    "Most likely cause",
    "Secondary cause",
    "Less likely cause",
    "Other factor",
  ];

  return {
    label: `${percent}% - ${fallbackLabels[index] || "Possible factor"}`,
    percent,
  };
}

function extractLogHighlights(log: string, gameKey: string) {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const minecraftTerms = [
    "exception",
    "error",
    "caused by:",
    "missingmods",
    "mixin",
    "forge",
    "fabric",
    "quilt",
    "java version",
    "minecraft version",
    "mod id:",
    "requested by:",
    "optifine",
    "sodium",
    "iris",
    "oculus",
    "rubidium",
  ];

  const simsTerms = [
    "exception",
    "error",
    "lastexception",
    "script call failed",
    "mccc",
    "wickedwhims",
    "basemental",
    "xml injector",
  ];

  const skyrimTerms = [
    "exception",
    "error",
    "skse",
    "dll",
    "address library",
    "crash",
    "plugin",
  ];

  const falloutTerms = [
    "exception",
    "error",
    "f4se",
    "buffout",
    "dll",
    "crash",
    "plugin",
  ];

  const genericTerms = ["exception", "error", "crash", "failed"];

  const terms =
    gameKey === "minecraft" ? minecraftTerms :
    gameKey === "sims4" ? simsTerms :
    gameKey === "skyrimse" ? skyrimTerms :
    gameKey === "fallout4" ? falloutTerms :
    genericTerms;

  const matches = lines.filter((line) => {
    const lower = line.toLowerCase();
    return terms.some((term) => lower.includes(term));
  });

  return Array.from(new Set(matches)).slice(0, 8);
}

function extractModsFromLog(log: string, gameKey: string) {
  const mods = new Set<string>();
  const lines = log.split("\n").map((line) => line.trim());

  if (gameKey === "minecraft") {
    for (const line of lines) {
      const lower = line.toLowerCase();

      const modIdMatch = line.match(/mod id:\s*'([^']+)'/i);
      if (modIdMatch?.[1]) {
        mods.add(modIdMatch[1].toLowerCase());
      }

      const requestedByMatch = line.match(/requested by:\s*'([^']+)'/i);
      if (requestedByMatch?.[1]) {
        mods.add(requestedByMatch[1].toLowerCase());
      }

      const modsListMatch = line.match(/^-\s*([a-z0-9._-]+)\b/i);
      if (modsListMatch?.[1]) {
        const candidate = modsListMatch[1].toLowerCase();
        if (!["mods", "system", "details"].includes(candidate)) {
          mods.add(candidate);
        }
      }

      const inlineNameMatch = line.match(
        /\b(examplemod|optifine|sodium|iris|oculus|rubidium|cloth_config|lithium|forge|fabric)\b/gi
      );
      if (inlineNameMatch) {
        for (const name of inlineNameMatch) {
          mods.add(name.toLowerCase());
        }
      }

      if (lower.includes("failed to load correctly")) {
        const failedMod = line.match(/^([A-Za-z0-9._-]+)\s*\(/);
        if (failedMod?.[1]) {
          mods.add(failedMod[1].toLowerCase());
        }
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "sims4") {
    for (const line of lines) {
      const matches = line.match(/\b(mccc|wickedwhims|basemental|ui cheats|better exceptions|xml injector|tmex)\b/gi);
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "skyrimse") {
    for (const line of lines) {
      const matches = line.match(/\b(skse|address library|enb|dyndolod|fnis|nemesis|skyui|ussep)\b/gi);
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "fallout4") {
    for (const line of lines) {
      const matches = line.match(/\b(f4se|buffout|looksmenu|mcm|sim settlements|unofficial patch)\b/gi);
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  for (const line of lines) {
    const matches = line.match(/\b([a-z0-9._-]{3,})\b/gi);
    if (matches) {
      for (const name of matches.slice(0, 3)) {
        mods.add(name.toLowerCase());
      }
    }
  }

  return Array.from(mods).slice(0, 8);
}

function detectGameFromLog(log: string): string | null {
  const lower = log.toLowerCase();

  if (
    lower.includes("minecraft") ||
    lower.includes("forge") ||
    lower.includes("fabric") ||
    lower.includes("quilt") ||
    lower.includes("mod id:")
  ) {
    return "minecraft";
  }

  if (
    lower.includes("lastexception") ||
    lower.includes("electronic arts") ||
    lower.includes("wickedwhims") ||
    lower.includes("mccc") ||
    lower.includes("xml injector")
  ) {
    return "sims4";
  }

  if (
    lower.includes("skse") ||
    lower.includes("skyrim special edition") ||
    lower.includes("address library") ||
    lower.includes("skyui")
  ) {
    return "skyrimse";
  }

  if (
    lower.includes("f4se") ||
    lower.includes("fallout4") ||
    lower.includes("fallout 4") ||
    lower.includes("buffout")
  ) {
    return "fallout4";
  }

  if (
    lower.includes("garrysmod") ||
    lower.includes("gmod") ||
    lower.includes("lua panic")
  ) {
    return "gmod";
  }

  if (
    lower.includes("stardew valley") ||
    lower.includes("smapi")
  ) {
    return "stardew_valley";
  }

  if (
    lower.includes("cyberpunk 2077") ||
    lower.includes("redscript") ||
    lower.includes("archive\\pc\\mod")
  ) {
    return "cyberpunk2077";
  }

  return null;
}

function getMostSuspiciousLine(log: string, gameKey: string) {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const scored = lines.map((line) => {
    const lower = line.toLowerCase();
    let score = 0;

    if (gameKey === "minecraft") {
      if (lower.includes("caused by:")) score += 10;
      if (lower.includes("exception")) score += 9;
      if (lower.includes("error")) score += 8;
      if (lower.includes("missingmods")) score += 9;
      if (lower.includes("mixina")) score += 6;
      if (lower.includes("mixin")) score += 8;
      if (lower.includes("nosuchmethoderror")) score += 10;
      if (lower.includes("outofmemoryerror")) score += 10;
      if (lower.includes("mod id:")) score += 7;
      if (lower.includes("requested by:")) score += 7;
      if (lower.includes("failed to load")) score += 7;
      if (lower.includes("invalidinjectionexception")) score += 9;
      if (lower.includes("unsupported class file major version")) score += 10;
    } else if (gameKey === "sims4") {
      if (lower.includes("lastexception")) score += 10;
      if (lower.includes("exception")) score += 8;
      if (lower.includes("error")) score += 7;
      if (lower.includes("script call failed")) score += 10;
      if (lower.includes("mccc")) score += 7;
      if (lower.includes("wickedwhims")) score += 7;
      if (lower.includes("basemental")) score += 7;
      if (lower.includes("xml injector")) score += 8;
      if (lower.includes("traceback")) score += 8;
    } else if (gameKey === "skyrimse") {
      if (lower.includes("skse")) score += 10;
      if (lower.includes("exception")) score += 8;
      if (lower.includes("error")) score += 7;
      if (lower.includes("address library")) score += 9;
      if (lower.includes("dll")) score += 8;
      if (lower.includes("plugin")) score += 7;
      if (lower.includes("crash")) score += 8;
      if (lower.includes("skyui")) score += 6;
    } else if (gameKey === "fallout4") {
      if (lower.includes("f4se")) score += 10;
      if (lower.includes("buffout")) score += 10;
      if (lower.includes("exception")) score += 8;
      if (lower.includes("error")) score += 7;
      if (lower.includes("dll")) score += 8;
      if (lower.includes("plugin")) score += 7;
      if (lower.includes("crash")) score += 8;
      if (lower.includes("looksmenu")) score += 6;
    } else {
      if (lower.includes("exception")) score += 8;
      if (lower.includes("error")) score += 7;
      if (lower.includes("crash")) score += 8;
      if (lower.includes("failed")) score += 6;
    }

    return { line, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].line : null;
}

function getProModalContent(
  context: "autoDetect" | "folderScan" | "saveAnalysis",
  gameLabel: string
) {
  switch (context) {
    case "autoDetect":
  return {
    eyebrow: "FIXMYGAME PRO",
    title: `Upgrade to unlock automatic ${gameLabel} log discovery`,
    description:
      `FixMyGame Pro can automatically find ${gameLabel} logs, load the best candidate, and start your troubleshooting workflow faster.`,
    features: [
      "Unlimited diagnostics",
      `Auto Detect ${gameLabel} Logs`,
      "Scan Entire Folder",
      "Save Analysis",
      "Faster troubleshooting workflow",
      "Smarter file discovery",
      "Better future multi-game support",
    ],
  };

    case "folderScan":
  return {
    eyebrow: "FIXMYGAME PRO",
    title: "Upgrade to unlock full-folder scanning",
    description:
      `FixMyGame Pro can scan an entire selected folder, surface likely ${gameLabel} logs, and load the best candidate automatically.`,
    features: [
      "Unlimited diagnostics",
      `Auto Detect ${gameLabel} Logs`,
      "Scan Entire Folder",
      "Save Analysis",
      "Faster troubleshooting workflow",
      "Smarter file discovery",
      "Better future multi-game support",
    ],
  };

    case "saveAnalysis":
  return {
    eyebrow: "FIXMYGAME PRO",
    title: "Upgrade to unlock saved analysis exports",
    description:
      `FixMyGame Pro lets you save your ${gameLabel} diagnosis to a file so you can keep it, share it, or compare multiple crash runs.`,
    features: [
      "Unlimited diagnostics",
      `Auto Detect ${gameLabel} Logs`,
      "Scan Entire Folder",
      "Save Analysis",
      "Faster troubleshooting workflow",
      "Smarter file discovery",
      "Better future multi-game support",
    ],
  };

    default:
  return {
    eyebrow: "FIXMYGAME PRO",
    title: "Upgrade to unlock the full desktop workflow",
    description:
      `FixMyGame Pro gives you the fastest way to diagnose ${gameLabel} crashes without manual digging.`,
    features: [
      "Unlimited diagnostics",
      `Auto Detect ${gameLabel} Logs`,
      "Scan Entire Folder",
      "Save Analysis",
      "Faster troubleshooting workflow",
    ],
  };
  }
}

const GAME_PRESETS = [
  { key: "minecraft", label: "Minecraft (Modded)" },
  { key: "sims4", label: "The Sims 4" },
  { key: "skyrimse", label: "Skyrim Special Edition" },
  { key: "gmod", label: "Garry's Mod" },
  { key: "fallout4", label: "Fallout 4" },
  { key: "cyberpunk2077", label: "Cyberpunk 2077" },
  { key: "starfield", label: "Starfield" },
  { key: "cities_skylines", label: "Cities: Skylines" },
  { key: "stardew_valley", label: "Stardew Valley" },
  { key: "rimworld", label: "RimWorld" },
  { key: "project_zomboid", label: "Project Zomboid" },
  { key: "terraria", label: "Terraria" },
  { key: "kerbal_space_program", label: "Kerbal Space Program" },
  { key: "bannerlord", label: "Bannerlord (Mount & Blade II)" },
  { key: "valheim", label: "Valheim" },
  { key: "slime_rancher_2", label: "Slime Rancher 2" },
  { key: "resident_evil_re", label: "Resident Evil (RE Engine)" },
  { key: "lethal_company", label: "Lethal Company" },
  { key: "palworld", label: "Palworld" },
  { key: "custom", label: "Custom / Other" },
];

const GAME_PROFILES: Record<
  string,
  {
    label: string;
    supportsAutoDetect: boolean;
    supportsModsFolder: boolean;
    supportsLogsFolder: boolean;
  }
> = {
  minecraft: {
    label: "Minecraft (Modded)",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  sims4: {
    label: "The Sims 4",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  skyrimse: {
    label: "Skyrim Special Edition",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  gmod: {
    label: "Garry's Mod",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  fallout4: {
    label: "Fallout 4",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  cyberpunk2077: {
    label: "Cyberpunk 2077",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  starfield: {
    label: "Starfield",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  cities_skylines: {
    label: "Cities: Skylines",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  stardew_valley: {
    label: "Stardew Valley",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  rimworld: {
    label: "RimWorld",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  project_zomboid: {
    label: "Project Zomboid",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  terraria: {
    label: "Terraria",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  kerbal_space_program: {
    label: "Kerbal Space Program",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  bannerlord: {
    label: "Bannerlord (Mount & Blade II)",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  valheim: {
    label: "Valheim",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  slime_rancher_2: {
    label: "Slime Rancher 2",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  resident_evil_re: {
    label: "Resident Evil (RE Engine)",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  lethal_company: {
    label: "Lethal Company",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  palworld: {
    label: "Palworld",
    supportsAutoDetect: false,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  custom: {
    label: "Custom / Other",
    supportsAutoDetect: false,
    supportsModsFolder: false,
    supportsLogsFolder: false,
  },
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3001";

  async function fetchDebugWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJSON<{
        headerVid: string | null;
        cookieVid: string | null;
        cookiePro: string | null;
        resolvedVid: string | null;
        redisPro: string | null;
      }>(`${API_BASE_URL}/api/debug-pro`, { method: "GET" });
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  throw new Error("debug-pro failed");
}

export default function Page() {
  const [selectedGameKey, setSelectedGameKey] = useState("minecraft");
  const [gpuModel, setGpuModel] = useState("RTX 3060");
  const [driverVersion, setDriverVersion] = useState("551.86");
  const [graphicsApiMode, setGraphicsApiMode] = useState("Auto Detect");
  const [crashLog, setCrashLog] = useState("");
  const [currentLogPath, setCurrentLogPath] = useState("");

  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState(3);
  const [remaining, setRemaining] = useState(3);

  const [loadingLimit, setLoadingLimit] = useState(true);
  const [running, setRunning] = useState(false);
  const [loadingDesktopLog, setLoadingDesktopLog] = useState(false);
  const [scanningLogs, setScanningLogs] = useState(false);
  const [result, setResult] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [actionMsg, setActionMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showFixGuide, setShowFixGuide] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [proModalContext, setProModalContext] = useState<"autoDetect" | "folderScan" | "saveAnalysis">("autoDetect");
  const [detectedLogs, setDetectedLogs] = useState<
  { name: string; fullPath: string; lastModified?: number; size?: number }[]
>([]);
  const [hasScannedLogs, setHasScannedLogs] = useState(false);
  const [detectedSignals, setDetectedSignals] = useState<AnalyzeResponse["detectedSignals"] | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse["analysis"] | null>(null);
  const [quickSignals, setQuickSignals] = useState<{
    loader?: string | null;
    java?: string | null;
    error?: string | null;
  }>({});
  const [debugVid, setDebugVid] = useState("");
const [debugProStatus, setDebugProStatus] = useState("");
  const [logHighlights, setLogHighlights] = useState<string[]>([]);
  const [liveMods, setLiveMods] = useState<string[]>([]);
  const [mostSuspiciousLine, setMostSuspiciousLine] = useState<string | null>(null);
  const canRun = useMemo(() => isPro || remaining > 0, [isPro, remaining]);
  const smartFixPath = useMemo(
    () => getSmartFixPath(detectedSignals, analysis, selectedGameKey),
    [detectedSignals, analysis, selectedGameKey]
  );
  const selectedGame = useMemo(
  () => GAME_PRESETS.find((g) => g.key === selectedGameKey) ?? GAME_PRESETS[0],
  [selectedGameKey]
);

const gameTitle = selectedGame.label;

  const proModalContent = useMemo(
  () => getProModalContent(proModalContext, gameTitle),
  [proModalContext, gameTitle]
);

const selectedGameProfile = useMemo(
  () => GAME_PROFILES[selectedGameKey] ?? GAME_PROFILES.minecraft,
  [selectedGameKey]
);

const topFeaturePills = useMemo(
  () => getTopFeaturePills(selectedGameKey),
  [selectedGameKey]
);

useEffect(() => {
if (typeof window !== "undefined") {
  let vid = window.localStorage.getItem("fmg_vid");

  if (!vid) {
    vid = crypto.randomUUID();
    window.localStorage.setItem("fmg_vid", vid);
  }

  document.cookie = `vid=${vid}; path=/; max-age=31536000; SameSite=Lax`;
  setDebugVid(vid);
}
  let cancelled = false;

  async function loadLimit() {
    setLoadingLimit(true);
    try {
      const data = await fetchJSON<LimitResponse>(`${API_BASE_URL}/api/limit`, { method: "GET" });

const debug = await fetchDebugWithRetry();

setDebugProStatus(
  `headerVid=${debug.headerVid ?? "null"} | cookieVid=${debug.cookieVid ?? "null"} | cookiePro=${debug.cookiePro ?? "null"} | resolvedVid=${debug.resolvedVid ?? "null"} | redisPro=${debug.redisPro ?? "null"}`
);
      if (cancelled) return;

      setIsPro(Boolean(data.isPro));
      setLimit(Number.isFinite(data.limit) ? data.limit : 3);
      setRemaining(Number.isFinite(data.remaining) ? data.remaining : 3);
    } catch {
      if (cancelled) return;
      setIsPro(false);
      setLimit(3);
      setRemaining(3);
      setDebugProStatus("debug-pro temporarily unavailable");
    } finally {
      if (!cancelled) setLoadingLimit(false);
    }
  }

  loadLimit();
  setDesktopConnected(Boolean(window.fixMyGame));

  return () => {
    cancelled = true;
  };
}, []);

  function showCrashLogHelp() {
  const helpText: Record<string, string> = {
    minecraft: `Minecraft (CurseForge / Forge / Fabric / Prism / Modrinth):
- Instance folder > logs/latest.log
- Instance folder > crash-reports/*.txt
- CurseForge app: open the modpack > ... > Open Folder`,

    sims4: `The Sims 4:
- Documents > Electronic Arts > The Sims 4
- Look for: lastException files, Better Exceptions output, mod-related logs
- Mods folder: Documents > Electronic Arts > The Sims 4 > Mods`,

    skyrimse: `Skyrim Special Edition:
- Documents > My Games > Skyrim Special Edition
- Check SKSE logs if installed
- Mod manager users may also need to inspect MO2 / Vortex profiles`,

    fallout4: `Fallout 4:
- Documents > My Games > Fallout4
- Check F4SE logs if installed
- Mod manager users may also need to inspect MO2 / Vortex profiles`,

    gmod: `Garry's Mod:
- Steam install folder > GarrysMod > garrysmod
- Also check addon folders and any Lua-related error output`,

    stardew_valley: `Stardew Valley:
- %AppData% > StardewValley > ErrorLogs
- If using SMAPI, also check the SMAPI console/log output`,

    cyberpunk2077: `Cyberpunk 2077:
- Check the game install folder and mod folders
- Also check AppData / CD Projekt Red / Cyberpunk 2077 for logs and config files`,

    custom: `Custom / Other:
- Use "Load Crash Log From Computer" to choose the most relevant log manually
- Or use "Scan Entire Folder" to search a game folder for useful logs`,
  };

  alert(
    helpText[selectedGameKey] ||
      `Selected game: ${gameTitle}
- Use "Load Crash Log From Computer" to choose a relevant log manually
- Or use "Scan Entire Folder" to search the game folder for useful logs`
  );
}

  async function loadLogFromComputer() {
    setErrorMsg("");

    if (!window.fixMyGame?.pickLogFile || !window.fixMyGame?.readLogFile) {
      setErrorMsg("Desktop file loading is only available inside the Electron app.");
      return;
    }

    try {
      setLoadingDesktopLog(true);

      const filePath = await window.fixMyGame.pickLogFile();
      if (!filePath) return;

      const contents = await window.fixMyGame.readLogFile(filePath);
      setCurrentLogPath(filePath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

if (detectedGame && detectedGame !== selectedGameKey) {
  setSelectedGameKey(detectedGame);
  setActionMsg(`Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`);
  setTimeout(() => {
    setActionMsg("");
  }, 1800);
}

setCrashLog(contents);
setQuickSignals(quickDetect(contents, activeGameKey));
setLogHighlights(extractLogHighlights(contents, activeGameKey));
setLiveMods(extractModsFromLog(contents, activeGameKey));
setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load log file.";
      setErrorMsg(msg);
    } finally {
      setLoadingDesktopLog(false);
    }
  }

async function pickCustomScanFolder() {
  setErrorMsg("");

  if (!window.fixMyGame?.pickScanFolder || !window.fixMyGame?.scanCustomFolder) {
    setErrorMsg("Folder scanning is only available inside the Electron app.");
    return;
  }

  try {
    const folderPath = await window.fixMyGame.pickScanFolder();
    if (!folderPath) return;

    const logs = await window.fixMyGame.scanCustomFolder(folderPath);
    const normalizedLogs = Array.isArray(logs) ? logs : [];

    setDetectedLogs(normalizedLogs);
    setHasScannedLogs(true);

    if (normalizedLogs.length === 0) {
      setErrorMsg("No useful logs were found in the selected folder.");
      return;
    }

    const bestLog = normalizedLogs[0];

    if (!window.fixMyGame?.readLogFile) {
      setErrorMsg("Desktop file loading is only available inside the Electron app.");
      return;
    }

    const contents = await window.fixMyGame.readLogFile(bestLog.fullPath);
setCurrentLogPath(bestLog.fullPath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

if (detectedGame && detectedGame !== selectedGameKey) {
  setSelectedGameKey(detectedGame);
  setActionMsg(`Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`);
  setTimeout(() => {
    setActionMsg("");
  }, 1800);
}

setCrashLog(contents);
setQuickSignals(quickDetect(contents, activeGameKey));
setLogHighlights(extractLogHighlights(contents, activeGameKey));
setLiveMods(extractModsFromLog(contents, activeGameKey));
setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));
  } catch {
    setErrorMsg("Failed to scan the selected folder.");
  }
}

async function scanLogsForSelectedGame() {
  setErrorMsg("");

  if (!window.fixMyGame?.scanLogsForGame) {
    setErrorMsg("Desktop connection not detected. Restart the Electron app and try again.");
    return;
  }

  try {
    setScanningLogs(true);

    const logs = await window.fixMyGame.scanLogsForGame(selectedGameKey);
    const normalizedLogs = Array.isArray(logs) ? logs : [];

setDetectedLogs(normalizedLogs);
setHasScannedLogs(true);

if (normalizedLogs.length === 0) {
  setActionMsg("");
  return;
}

setActionMsg(`Found ${normalizedLogs.length} potential ${gameTitle} log file${normalizedLogs.length === 1 ? "" : "s"}.`);

setTimeout(() => {
  setActionMsg("");
}, 2500);

// AUTO-SELECT BEST LOG
if (normalizedLogs.length > 0) {
  const bestLog = normalizedLogs[0];

  if (!window.fixMyGame?.readLogFile) {
    setErrorMsg("Desktop file loading is only available inside the Electron app.");
    return;
  }

  const contents = await window.fixMyGame.readLogFile(bestLog.fullPath);
  setCurrentLogPath(bestLog.fullPath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

if (detectedGame && detectedGame !== selectedGameKey) {
  setSelectedGameKey(detectedGame);
  setActionMsg(`Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`);
  setTimeout(() => {
    setActionMsg("");
  }, 1800);
}

setCrashLog(contents);
setQuickSignals(quickDetect(contents, activeGameKey));
setLogHighlights(extractLogHighlights(contents, activeGameKey));
setLiveMods(extractModsFromLog(contents, activeGameKey));
setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));

  // AUTO RUN DIAGNOSTIC
  setTimeout(() => {
    runDiagnostic();
  }, 200);
}

  } catch {
  setErrorMsg(`Could not scan for ${gameTitle} logs. Restart the desktop app and try again.`);
} finally {
    setScanningLogs(false);
  }
}

async function loadDetectedLog(fullPath: string) {
  setErrorMsg("");

  if (!window.fixMyGame?.readLogFile) {
    setErrorMsg("Desktop file loading is only available inside the Electron app.");
    return;
  }

  try {
    setLoadingDesktopLog(true);

    const contents = await window.fixMyGame.readLogFile(fullPath);
setCurrentLogPath(fullPath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

if (detectedGame && detectedGame !== selectedGameKey) {
  setSelectedGameKey(detectedGame);
  setActionMsg(`Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`);
  setTimeout(() => {
    setActionMsg("");
  }, 1800);
}

setCrashLog(contents);
setQuickSignals(quickDetect(contents, activeGameKey));
setLogHighlights(extractLogHighlights(contents, activeGameKey));
setLiveMods(extractModsFromLog(contents, activeGameKey));
setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load detected log.";
    setErrorMsg(msg);
  } finally {
    setLoadingDesktopLog(false);
  }
}

async function openModsFolder(silent = false) {
  if (!silent) {
    setErrorMsg("");
    setActionMsg("");
  }

  if (!window.fixMyGame?.openModsFolder) {
    if (!silent) {
      setErrorMsg("Open Mods Folder is only available inside the Electron app.");
    }
    return false;
  }

  try {
    const response = await window.fixMyGame.openModsFolder(selectedGameKey);

    if (!response?.ok) {
      const error = (response?.error || "").toLowerCase();

      if (!silent) {
        if (error.includes("not found") || error.includes("no such file")) {
          setErrorMsg(`No ${gameTitle} installation detected on this device.`);
        } else if (error.includes("empty") || error.includes("no mods")) {
          setErrorMsg(
            `${gameTitle} is installed, but no mods folder was found or it is empty.`
          );
        } else {
          setErrorMsg(
            response?.error || `Could not open the ${gameTitle} mods folder.`
          );
        }
      }

      return false;
    }

    if (!silent) {
      setActionMsg(`Opened ${gameTitle} mods folder: ${response.path}`);

      setTimeout(() => {
        setActionMsg("");
      }, 2500);
    }

    return true;
  } catch (error: unknown) {
    if (!silent) {
      const msg =
        error instanceof Error
          ? error.message
          : `Failed to open the ${gameTitle} mods folder.`;
      setErrorMsg(msg);
    }

    return false;
  }
}

async function openLogsFolder(silent = false) {
  if (!silent) {
    setErrorMsg("");
    setActionMsg("");
  }

  if (!window.fixMyGame?.openLogsFolder) {
    if (!silent) {
      setErrorMsg("Open Logs Folder is only available inside the Electron app.");
    }
    return false;
  }

  try {
    const response = await window.fixMyGame.openLogsFolder(selectedGameKey);

    if (!response?.ok) {
      const error = (response?.error || "").toLowerCase();

      if (!silent) {
        if (error.includes("not found") || error.includes("no such file")) {
          setErrorMsg(`No ${gameTitle} installation detected on this device.`);
        } else if (error.includes("empty") || error.includes("no logs")) {
          setErrorMsg(
            `${gameTitle} is installed, but no crash logs were found yet. Launch the game once or generate a crash.`
          );
        } else {
          setErrorMsg(
            response?.error || `Could not open the ${gameTitle} logs folder.`
          );
        }
      }

      return false;
    }

    if (!silent) {
      setActionMsg(`Opened ${gameTitle} logs folder: ${response.path}`);

      setTimeout(() => {
        setActionMsg("");
      }, 2500);
    }

    return true;
  } catch (error: unknown) {
    if (!silent) {
      const msg =
        error instanceof Error
          ? error.message
          : `Failed to open the ${gameTitle} logs folder.`;
      setErrorMsg(msg);
    }

    return false;
  }
}

  async function runDiagnostic() {
    setErrorMsg("");
    setResult("");

    setDetectedSignals(null);
    setAnalysis(null);
    
    if (!crashLog.trim()) {
      setErrorMsg("Paste a crash log / error first.");
      return;
    }

    if (!canRun) {
      setErrorMsg("Daily limit reached. Upgrade to Pro for unlimited diagnostics.");
      return;
    }

    setRunning(true);
    try {
      const payload = {
        gameKey: selectedGameKey,
        gameTitle,
        gpuModel,
        driverVersion,
        graphicsApiMode,
        crashLog,
      };

      const data = await fetchJSON<AnalyzeResponse>(`${API_BASE_URL}/api/analyze`, {
  method: "POST",
  body: JSON.stringify(payload),
});

setResult(data.result || "");
setAnalysis(data.analysis ?? null);
setDetectedSignals(data.detectedSignals ?? null);

      const lim = await fetchJSON<LimitResponse>(`${API_BASE_URL}/api/limit`, { method: "GET" });
      setIsPro(Boolean(lim.isPro));
      setLimit(Number.isFinite(lim.limit) ? lim.limit : 3);
      setRemaining(Number.isFinite(lim.remaining) ? lim.remaining : 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Diagnostic failed.";
      setErrorMsg(msg);
    } finally {
      setRunning(false);
    }
  }

async function upgradeToPro() {
  setErrorMsg("");
  try {
    const data = await fetchJSON<CheckoutResponse>(`${API_BASE_URL}/api/checkout`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (!data.url) {
      throw new Error("Checkout failed.");
    }

    window.location.href = data.url;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Checkout failed.";
    setErrorMsg(msg);
    alert("Checkout failed.");
  }
}
async function saveResult() {
  if (!window.fixMyGame?.saveAnalysis) {
    setErrorMsg("Save is only available inside the Electron app.");
    return;
  }

  const textToSave = analysis
    ? [
        "Quick Fix First:",
        analysis.quickFixFirst,
        "",
        `Issue: ${analysis.issue}`,
        `Confidence Level: ${analysis.confidenceLevel}`,
        "Probability Breakdown:",
        ...analysis.probabilityBreakdown.map((item) => `- ${item}`),
        `Most Likely Cause: ${analysis.mostLikelyCause}`,
        "Recommended Fix Steps:",
        ...analysis.recommendedFixSteps.map((step, index) => `${index + 1}. ${step}`),
        `Need More Info: ${analysis.needMoreInfo}`,
      ].join("\n")
    : result;

  if (!textToSave.trim()) return;

  const safeGame = (gameTitle || "game").replace(/[^\w\-]+/g, "_");
  const fileName = `fixmygame-${safeGame}-analysis.txt`;

  try {
    const response = await window.fixMyGame.saveAnalysis(fileName, textToSave);

    if (response?.canceled) return;
    if (!response?.ok) {
      setErrorMsg(response?.error || "Failed to save analysis.");
      return;
    }
    setSaved(true);

setTimeout(() => {
  setSaved(false);
}, 1500);
  } catch {
    setErrorMsg("Failed to save analysis.");
  }
}

async function copyResult() {
  const textToCopy = analysis
    ? [
        "Quick Fix First:",
        analysis.quickFixFirst,
        "",
        `Issue: ${analysis.issue}`,
        `Confidence Level: ${analysis.confidenceLevel}`,
        "Probability Breakdown:",
        ...analysis.probabilityBreakdown.map((item) => `- ${item}`),
        `Most Likely Cause: ${analysis.mostLikelyCause}`,
        "Recommended Fix Steps:",
        ...analysis.recommendedFixSteps.map((step, index) => `${index + 1}. ${step}`),
        `Need More Info: ${analysis.needMoreInfo}`,
      ].join("\n")
    : result;

  if (!textToCopy.trim()) return;

  try {
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  } catch {
    setErrorMsg("Failed to copy result.");
  }
}
async function applyQuickFix() {
  if (!analysis) {
    setErrorMsg("Run a diagnostic first.");
    return;
  }

  const quickFixText = [
    `Quick Fix First: ${analysis.quickFixFirst}`,
    "",
    "Recommended Fix Steps:",
    ...analysis.recommendedFixSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");

  try {
    await navigator.clipboard.writeText(quickFixText);
    setActionMsg("Quick fix copied to clipboard. Start with step 1.");

    setTimeout(() => {
      setActionMsg("");
    }, 2000);
  } catch {
    setErrorMsg("Failed to copy quick fix.");
  }
}

function openStepByStepGuide() {
  if (!analysis) {
    setErrorMsg("Run a diagnostic first.");
    return;
  }

  setShowFixGuide(true);
}

async function openGameSettingsQuickAction() {
  setErrorMsg("");
  setActionMsg("");
    if (currentLogPath && window.fixMyGame?.openFolderPath) {
    try {
      const response = await window.fixMyGame.openFolderPath(currentLogPath);

      if (response?.ok) {
        setActionMsg(`Opened the folder for your loaded ${gameTitle} log.`);
        setTimeout(() => setActionMsg(""), 2500);
        return;
      }
    } catch {
      // fall through to normal game folder logic
    }
  }

  const hasDetectedGame =
    Boolean(detectedSignals?.loader) ||
    Boolean(detectedSignals?.gameVersion);

  const hasCrashEvidence =
    Boolean(crashLog.trim()) ||
    Boolean(analysis) ||
    detectedLogs.length > 0 ||
    logHighlights.length > 0 ||
    liveMods.length > 0 ||
    Boolean(mostSuspiciousLine);

  const hasAnyEvidence = hasDetectedGame || hasCrashEvidence;

  if (!hasAnyEvidence) {
    setErrorMsg(
      `No ${gameTitle} installation or crash logs were detected on this device yet.`
    );
    return;
  }

  if (selectedGameKey === "minecraft") {
    const openedLogs = await openLogsFolder(true);
    if (openedLogs) {
      setActionMsg(`Opened ${gameTitle} crash logs folder.`);
      setTimeout(() => setActionMsg(""), 2500);
      return;
    }

    const openedMods = await openModsFolder(true);
    if (openedMods) {
      setActionMsg(`Opened ${gameTitle} mods folder.`);
      setTimeout(() => setActionMsg(""), 2500);
      return;
    }

    if (!crashLog.trim() && detectedLogs.length === 0) {
      setErrorMsg(
        `No ${gameTitle} installation or crash logs were detected on this device yet.`
      );
    } else {
      setActionMsg(
        `${gameTitle} was detected from your loaded log, but no local game folder could be opened on this device.`
      );
      setTimeout(() => setActionMsg(""), 3000);
    }

    return;
  }

  if (selectedGameProfile.supportsModsFolder) {
    const openedMods = await openModsFolder(true);
    if (openedMods) {
      setActionMsg(`Opened ${gameTitle} mods folder.`);
      setTimeout(() => setActionMsg(""), 2500);
      return;
    }
  }

  if (selectedGameProfile.supportsLogsFolder) {
    const openedLogs = await openLogsFolder(true);
    if (openedLogs) {
      setActionMsg(`Opened ${gameTitle} logs folder.`);
      setTimeout(() => setActionMsg(""), 2500);
      return;
    }
  }

  if (!crashLog.trim() && detectedLogs.length === 0) {
    setErrorMsg(
      `No ${gameTitle} installation or crash logs were detected on this device yet.`
    );
  } else {
    setActionMsg(
      `${gameTitle} was detected from your loaded log, but no local game folder could be opened on this device.`
    );
    setTimeout(() => setActionMsg(""), 3000);
  }
}
  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-12 text-white">
      <h1 className="text-4xl font-extrabold tracking-tight">
        FixMyGame: AI Crash Diagnostics for Modded Games
      </h1>

      <p className="mt-3 max-w-3xl text-white/80">
  Diagnose crash logs and mod conflicts for Minecraft, The Sims 4, Skyrim,
  Fallout 4, and other modded PC games. Detect dependency issues, plugin
  failures, loader mismatches, and GPU/driver faults.
</p>

<div className="mt-6 flex flex-wrap gap-2">
  {topFeaturePills.map((pill, index) => {
    const classes = [
      "rounded-full px-3 py-1 text-xs font-medium",
      index === 0
        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
        : index === 1
        ? "border border-violet-400/20 bg-violet-400/10 text-violet-200"
        : index === 2
        ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
        : "border border-orange-400/20 bg-orange-400/10 text-orange-200",
    ].join(" ");

    return (
      <span key={pill} className={classes}>
        {pill}
      </span>
    );
  })}
</div>

<div className="mt-4 flex flex-wrap gap-2">
  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
  Active Game: {gameTitle}
</span>
  <span
    className={[
      "rounded-full px-3 py-1 text-xs font-medium",
      isPro
        ? "border border-amber-400/20 bg-amber-400/10 text-amber-200"
        : "border border-white/10 bg-white/5 text-white/80",
    ].join(" ")}
  >
    {isPro ? "Pro Plan" : "Free Plan"}
  </span>

  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
    {loadingLimit
      ? "Checking usage..."
      : isPro
      ? "Unlimited diagnostics"
      : `${remaining}/${limit} diagnostics left today`}
  </span>

  <span
    className={[
      "rounded-full px-3 py-1 text-xs font-medium",
      desktopConnected
        ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
        : "border border-red-400/20 bg-red-400/10 text-red-200",
    ].join(" ")}
  >
    {desktopConnected ? "Desktop Connected" : "Browser Mode"}
  </span>
</div>

<div className="mt-3 p-3 rounded-lg bg-white/5 text-xs leading-relaxed break-words">
<div><strong>Local vid:</strong> {debugVid || "none"}</div>
  <div><strong>Server debug:</strong> {debugProStatus || "loading..."}</div>
</div>

      <section className="mt-10 rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.55)] p-5">
        <div className="grid gap-4">
          <Field label="SELECTED GAME">
  <DarkSelect
  value={gameTitle}
  options={GAME_PRESETS.map((g) => g.label)}
  onChange={(label) => {
    const match = GAME_PRESETS.find((g) => g.label === label);
    if (match) setSelectedGameKey(match.key);
  }}
/>
</Field>

          <Field label="GPU MODEL">
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0b1220] text-white px-4 py-3 outline-none focus:border-white/20 appearance-none"

              value={gpuModel}
              onChange={(e) => setGpuModel(e.target.value)}
              placeholder="RTX 3070 / RX 6800"
            />
          </Field>

          <Field label="DRIVER VERSION">
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0b1220] text-white px-4 py-3 outline-none focus:border-white/20 appearance-none"

              value={driverVersion}
              onChange={(e) => setDriverVersion(e.target.value)}
              placeholder="551.86"
            />
          </Field>

          <Field label="GRAPHICS API MODE">
  <DarkSelect
    value={graphicsApiMode}
    options={["Auto Detect", "DirectX 11", "DirectX 12", "Vulkan", "OpenGL"]}
    onChange={setGraphicsApiMode}
  />
</Field>

          <div className="flex flex-wrap gap-3">
  <button
    type="button"
    onClick={loadLogFromComputer}
    disabled={loadingDesktopLog}
    className="rounded-xl bg-purple-600 px-4 py-2 font-medium hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {loadingDesktopLog ? "Loading log..." : "Load Crash Log From Computer"}
  </button>

  <button
  type="button"
  onClick={() => {
    if (!isPro) {
      setProModalContext("autoDetect");
      setShowProModal(true);
      return;
    }

    scanLogsForSelectedGame();
  }}
  disabled={scanningLogs || !selectedGameProfile.supportsAutoDetect}
  className={[
    "rounded-xl px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
    isPro
      ? "bg-cyan-600 hover:bg-cyan-500"
      : "bg-amber-500/10 text-amber-200 border border-amber-400/20 hover:bg-amber-500/15",
  ].join(" ")}
>
  {scanningLogs
  ? "Scanning..."
  : selectedGameProfile.supportsAutoDetect
  ? isPro
    ? `Auto Detect ${gameTitle} Logs`
    : `Auto Detect ${gameTitle} Logs (Pro)`
  : `Auto Detect ${gameTitle} Logs Not Available Yet`}
</button>
<button
  type="button"
onClick={() => {
  if (!isPro) {
    setProModalContext("folderScan");
    setShowProModal(true);
    return;
  }

  pickCustomScanFolder();
}}
  className={[
    "rounded-xl px-4 py-2 font-medium transition",
    isPro
      ? "bg-white/10 hover:bg-white/15"
      : "bg-amber-500/10 text-amber-200 border border-amber-400/20 hover:bg-amber-500/15",
  ].join(" ")}
>
  {isPro ? "Scan Entire Folder" : "Scan Entire Folder (Pro)"}
</button>
</div>

{detectedLogs.length > 0 ? (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="text-xs font-semibold tracking-widest text-white/70">
      DETECTED LOGS
    </div>

    <div className="mt-3 grid gap-2">
      {detectedLogs.map((log) => (
        <button
          key={log.fullPath}
          type="button"
          onClick={() => loadDetectedLog(log.fullPath)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
        >
          <div className="font-medium text-white">{log.name}</div>
          <div className="mt-1 truncate text-xs text-white/50">{log.fullPath}</div>
          <div className="mt-1 text-[11px] text-white/40">
  {typeof log.size === "number" ? `${Math.round(log.size / 1024)} KB` : ""}
</div>
        </button>
      ))}
    </div>
  </div>
) : null}

<div className="mt-2 flex flex-wrap gap-2">
{selectedGameProfile.supportsModsFolder ? (
  <button
    type="button"
    onClick={() => {
  openModsFolder();
}}
    className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85 transition hover:bg-white/15"
  >
    Open {gameTitle} Mods Folder
  </button>
) : null}

{selectedGameProfile.supportsLogsFolder ? (
  <button
    type="button"
    onClick={() => {
  openLogsFolder();
}}
    className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
  >
    Open {gameTitle} Crash Logs Folder
  </button>
) : null}
</div>

{hasScannedLogs && detectedLogs.length === 0 ? (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
    No {gameTitle} logs were found in the detected folders yet. Try &ldquo;Load Crash Log From Computer&rdquo; or &ldquo;Scan Entire Folder&rdquo;.
  </div>
) : null}

          <Field
            label="CRASH LOG / ERROR"
            rightLinkText="Where do I find my crash log?"
            onRightLinkClick={showCrashLogHelp}
          >
            <textarea
              className="min-h-[220px] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm outline-none focus:border-white/20"
              value={crashLog}
              onChange={(e) => {
  const value = e.target.value;
setCrashLog(value);
setCurrentLogPath("");

const detectedGame = detectGameFromLog(value);
const activeGameKey = detectedGame || selectedGameKey;

if (detectedGame && detectedGame !== selectedGameKey) {
  setSelectedGameKey(detectedGame);
  setActionMsg(`Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`);
  setTimeout(() => {
    setActionMsg("");
  }, 1800);
}

if (value.trim().length > 40) {
  setQuickSignals(quickDetect(value, activeGameKey));
  setLogHighlights(extractLogHighlights(value, activeGameKey));
  setLiveMods(extractModsFromLog(value, activeGameKey));
  setMostSuspiciousLine(getMostSuspiciousLine(value, activeGameKey));
} else {
  setQuickSignals({});
  setLogHighlights([]);
  setLiveMods([]);
  setMostSuspiciousLine(null);
}
}}
              placeholder={
  selectedGameKey === "minecraft"
    ? "Paste your Forge/Fabric/CurseForge crash report or latest.log here..."
    : selectedGameKey === "sims4"
    ? "Paste your Sims 4 lastException, Better Exceptions output, or mod error log here..."
    : selectedGameKey === "skyrimse"
    ? "Paste your Skyrim crash log, SKSE log, or plugin error here..."
    : selectedGameKey === "fallout4"
    ? "Paste your Fallout 4 crash log, Buffout log, or F4SE/plugin error here..."
    : "Paste your crash log, mod/plugin error, or diagnostic output here..."
}
            />
          </Field>
          {quickSignals.loader || quickSignals.java || quickSignals.error ? (
  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
    <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
      LIVE DETECTION
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {quickSignals.loader ? (
  <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-200">
    {getLoaderLabelForGame(selectedGameKey)}: {quickSignals.loader}
  </span>
) : null}

      {quickSignals.java && getJavaLabelForGame(selectedGameKey) ? (
  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
    {getJavaLabelForGame(selectedGameKey)} {quickSignals.java}
  </span>
) : null}

      {quickSignals.error ? (
  <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-200">
    Error: {quickSignals.error}
  </span>
) : null}
    </div>
  </div>
) : null}
        </div>

{logHighlights.length > 0 ? (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="text-xs font-semibold tracking-widest text-white/70">
      LOG HIGHLIGHTS
    </div>

    <div className="mt-3 grid gap-2">
      {logHighlights.map((line, index) => (
        <div
  key={`${index}-${line}`}
  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white/85 whitespace-pre-wrap break-words overflow-hidden"
>
  {line}
</div>
      ))}
    </div>
  </div>
) : null}

{liveMods.length > 0 ? (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="text-xs font-semibold tracking-widest text-white/70">
      LIVE MODS DETECTED
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {liveMods.map((mod) => (
        <span
          key={mod}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
        >
          {mod}
        </span>
      ))}
    </div>
  </div>
) : null}

{mostSuspiciousLine ? (
  <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
    <div className="text-xs font-semibold tracking-widest text-red-200/80">
      MOST SUSPICIOUS LINE
    </div>

    <div className="mt-3 rounded-xl bg-black/20 px-3 py-3 font-mono text-sm text-white/90">
      {mostSuspiciousLine}
    </div>
  </div>
) : null}

        <div className="mt-6">
          <button
  className={[
    "flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-lg font-semibold transition",
    canRun && !running ? "bg-blue-600 hover:bg-blue-500" : "bg-blue-900/60 text-white/60",
  ].join(" ")}
  onClick={runDiagnostic}
  disabled={!canRun || running}
>
  {running ? (
    <>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      Running Diagnostic...
    </>
  ) : (
    `Run ${gameTitle} Diagnostic`
  )}
</button>

          <div className="mt-2 flex items-center justify-between text-sm text-white/70">
            <div>
              {loadingLimit ? (
                "Checking daily limit..."
              ) : isPro ? (
                "Pro: Unlimited"
              ) : (
                <>
                  Free diagnostics left today:{" "}
                  <span className="font-semibold">{remaining}</span> / {limit}
                </>
              )}
            </div>

            {!isPro && (
              <button
                type="button"
                className="underline underline-offset-4 hover:text-white"
                onClick={upgradeToPro}
              >
                Upgrade to Pro
              </button>
            )}
          </div>

{/* 🔥 FIX ASSISTANT */}
<div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
    FIX ASSISTANT
  </div>

  <div className="mt-3 grid gap-2">
  <button
    type="button"
    onClick={applyQuickFix}
    disabled={!analysis}
    className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
  >
    ⚡ Apply Quick Fix (Recommended)
  </button>

  <button
    type="button"
    onClick={openStepByStepGuide}
    disabled={!analysis}
    className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
  >
    🧭 Step-by-Step Fix Guide
  </button>

  <button
    type="button"
    onClick={openGameSettingsQuickAction}
    className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30"
  >
    📂 Open Game Settings
  </button>
</div>
</div>

{!loadingLimit && !isPro && remaining <= 0 ? (
  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/40 p-4 text-sm text-amber-100">
    <div className="font-semibold">
      You’ve used all free diagnostics today.
    </div>
    <div className="mt-1 text-amber-100/90">
  Unlock unlimited diagnostics, Auto Detect {gameTitle} Logs, Scan Entire Folder, Save Analysis, and faster troubleshooting workflows with Pro.
</div>
  </div>
) : null}

{actionMsg ? (
  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-100">
    {actionMsg}
  </div>
) : null}

          {errorMsg ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
              {errorMsg}
            </div>
          ) : null}
        </div>
      </section>

{detectedSignals ? (
  <section className="mt-6 rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.45)] p-5">
    <div className="text-xs font-semibold tracking-widest text-white/70">
      DETECTED SIGNALS
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {detectedSignals.likelyCategory ? (
  <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-200">
    {formatCategoryLabel(detectedSignals.likelyCategory, selectedGameKey)}
  </span>
) : null}

      {detectedSignals.loader ? (
  <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-200">
    {getLoaderLabelForGame(selectedGameKey)}: {formatLoaderLabel(detectedSignals.loader)}
  </span>
) : null}

      {detectedSignals.gameVersion ? (
        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
          {getVersionLabelForGame(selectedGameKey)} {detectedSignals.gameVersion}
        </span>
      ) : null}

      {detectedSignals.javaVersion && getJavaLabelForGame(selectedGameKey) ? (
  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
    {getJavaLabelForGame(selectedGameKey)} {detectedSignals.javaVersion}
  </span>
) : null}

      {detectedSignals.errorType ? (
        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-200">
          {detectedSignals.errorType}
        </span>
      ) : null}

      {detectedSignals.suspectedMods?.map((mod) => (
        <span
          key={mod}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
        >
          {mod}
        </span>
      ))}
    </div>
  </section>
) : null}


{analysis ? (
  <section className="mt-6 rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.45)] p-5">
    <div className="text-xs font-semibold tracking-widest text-white/70">
      SMART FIX PATH
    </div>

    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
<div className="flex items-center gap-2 text-lg font-semibold text-white">
  <span className="h-2 w-2 rounded-full bg-cyan-300" />
  {smartFixPath.title}
</div>

      <ul className="mt-4 grid gap-2">
        {smartFixPath.bullets.map((bullet) => (
          <li
            key={bullet}
            className="rounded-xl bg-black/20 px-3 py-3 text-white/90"
          >
            {bullet}
          </li>
        ))}
      </ul>
    </div>
    {analysis ? (
  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
    <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
      QUICK ACTIONS
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
  {selectedGameProfile.supportsModsFolder ? (
    <button
      type="button"
      onClick={() => {
  openModsFolder();
}}
      className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
    >
      Open {gameTitle} Mods Folder
    </button>
  ) : null}

  {selectedGameProfile.supportsLogsFolder ? (
    <button
      type="button"
      onClick={() => {
  openLogsFolder();
}}
      className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
    >
      Open {gameTitle} Crash Logs Folder
    </button>
  ) : null}

  <button
    type="button"
    onClick={async () => {
      const modsText =
        detectedSignals?.suspectedMods?.length
          ? detectedSignals.suspectedMods.join(", ")
          : liveMods.length
          ? liveMods.join(", ")
          : "No suspected mods detected.";

      try {
        await navigator.clipboard.writeText(modsText);
        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 1500);
      } catch {
        setErrorMsg("Failed to copy suspected mods.");
      }
    }}
    className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
  >
    {copied ? "Copied!" : "Copy Suspected Mods"}
  </button>

  <button
    type="button"
    onClick={runDiagnostic}
    disabled={!canRun || running}
    className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {running ? "Running..." : "Re-run Diagnostic"}
  </button>
</div>
  </div>
) : null}
  </section>
) : null}

<section className="mt-6">
  {analysis ? (
    <div className="rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.55)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold tracking-widest text-white/70">
          DIAGNOSTIC RESULT
        </div>

<div className="flex items-center gap-2">
<button
  type="button"
  onClick={() => {
    if (!isPro) {
      setProModalContext("saveAnalysis");
      setShowProModal(true);
      return;
    }

    saveResult();
  }}
  className={[
    "rounded-lg px-3 py-1.5 text-sm transition",
    isPro
      ? "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
      : "border border-amber-400/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15",
  ].join(" ")}
>
  {isPro ? (saved ? "Saved!" : "Save Analysis") : "Save Analysis (Pro)"}
</button>

  <button
    type="button"
    onClick={copyResult}
    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
  >
    {copied ? "Copied!" : "Copy Result"}
  </button>
</div>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
          <div className="text-xs font-semibold tracking-widest text-yellow-200/80">
            QUICK FIX FIRST
          </div>
<div className="mt-2 text-lg font-semibold text-white tracking-wide flex items-center gap-2">
  <span className="text-yellow-300">⚡</span>
  {analysis.quickFixFirst}
</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold tracking-widest text-white/60">
              ISSUE
            </div>
            <div className="mt-2 text-white">{analysis.issue}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold tracking-widest text-white/60">
              CONFIDENCE
            </div>
<div
  className={[
    "mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
    analysis.confidenceLevel === "High"
      ? "bg-green-500/20 text-green-300"
      : analysis.confidenceLevel === "Medium"
      ? "bg-yellow-500/20 text-yellow-300"
      : "bg-red-500/20 text-red-300",
  ].join(" ")}
>
  {analysis.confidenceLevel}
</div>          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold tracking-widest text-white/60">
            PROBABILITY BREAKDOWN
          </div>
          <ul className="mt-3 grid gap-2 text-white/90">
            {analysis.probabilityBreakdown.map((item, index) => {
  const formatted = formatProbabilityItem(item, index);

  return (
    <li key={`${index}-${item}`} className="rounded-xl bg-white/5 px-3 py-2">
      <div className="flex justify-between text-sm">
        <span>{formatted.label}</span>
      </div>

      <div className="mt-2 h-2 w-full rounded bg-white/10">
        <div
          className="h-2 rounded bg-blue-500"
          style={{
            width: `${Math.max(8, Math.min(100, formatted.percent))}%`,
          }}
        />
      </div>
    </li>
  );
})}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold tracking-widest text-white/60">
            MOST LIKELY CAUSE
          </div>
          <div className="mt-2 text-white">{analysis.mostLikelyCause}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold tracking-widest text-white/60">
            RECOMMENDED FIX STEPS
          </div>
          <ol className="mt-3 grid gap-2 text-white/90">
            {analysis.recommendedFixSteps.map((step, index) => (
              <li key={`${index}-${step}`} className="rounded-xl bg-white/5 px-3 py-2">
                <span className="mr-2 font-semibold text-white">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold tracking-widest text-white/60">
            NEED MORE INFO
          </div>
          <div className="mt-2 text-white/90">{analysis.needMoreInfo}</div>
        </div>

        <details className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <summary className="cursor-pointer text-xs font-semibold tracking-widest text-white/60">
            RAW TEXT VERSION
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-sm leading-relaxed max-h-[300px] overflow-y-auto">
            {result}
          </pre>
        </details>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.35)] p-5 text-white/70">
  Paste a {gameTitle} crash log, error report, or plugin/mod diagnostic and run a scan to see results here.
</div>
  )}
</section>
{showFixGuide && analysis ? (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    onClick={() => setShowFixGuide(false)}
  >
    <div
      className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#071224] p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        STEP-BY-STEP FIX GUIDE
      </div>

      <h2 className="mt-2 text-2xl font-bold text-white">
        {gameTitle} Troubleshooting Guide
      </h2>

      <p className="mt-3 text-white/75">
        Follow these steps in order. Test the game after each change so you know exactly what fixed it.
      </p>

      <div className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
        <div className="text-xs font-semibold tracking-widest text-yellow-200/80">
          START HERE
        </div>
        <div className="mt-2 text-lg font-semibold text-white">
          {analysis.quickFixFirst}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {analysis.recommendedFixSteps.map((step, index) => (
          <div
            key={`${index}-${step}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-white/90"
          >
            <div className="text-xs font-semibold tracking-widest text-white/50">
              STEP {index + 1}
            </div>
            <div className="mt-2">{step}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs font-semibold tracking-widest text-white/60">
          MOST LIKELY CAUSE
        </div>
        <div className="mt-2 text-white">{analysis.mostLikelyCause}</div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowFixGuide(false)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Close
        </button>

        <button
          type="button"
          onClick={applyQuickFix}
          className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-black transition hover:bg-cyan-400"
        >
          Copy Quick Fix
        </button>
      </div>
    </div>
  </div>
) : null}
{showProModal ? (
  <div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
  onClick={() => setShowProModal(false)}
>
    <div 
    className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#071224] p-6 shadow-2xl"
    onClick={(e) => e.stopPropagation()}
>
<div className="text-xs font-semibold tracking-widest text-amber-200/80">
  {proModalContent.eyebrow}
</div>

<h2 className="mt-2 text-2xl font-bold text-white">
  {proModalContent.title}
</h2>

<p className="mt-3 text-white/75">
  {proModalContent.description}
</p>

      <div className="mt-5 grid gap-2">
        {proModalContent.features.map((feature) => (
          <div
            key={feature}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/90"
          >
            {feature}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowProModal(false)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Maybe Later
        </button>

        <button
          type="button"
          onClick={() => {
            setShowProModal(false);
            upgradeToPro();
          }}
          className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-black transition hover:bg-amber-400 shadow-lg shadow-amber-500/20"
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  </div>
) : null}
    </main>
  );
}

function DarkSelect(props: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (!rootRef.current) return;
    if (!rootRef.current.contains(event.target as Node)) {
      setOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-left text-white outline-none transition hover:border-white/20"
      >
        <span>{props.value}</span>
        <span className="text-white/60">{open ? "▴" : "▾"}</span>
      </button>

      {open ? (
        <div
          className="custom-scroll absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl ring-1 ring-black/40"
        >
          {props.options.map((option, index) => {
            const active = option === props.value;

            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  props.onChange(option);
                  setOpen(false);
                }}
                className={[
                  "block w-full px-4 py-2.5 text-left transition",
                  index === 0 ? "rounded-t-xl" : "",
                  index === props.options.length - 1 ? "rounded-b-xl" : "",
                  active
                    ? "bg-blue-400/15 text-white"
                    : "text-white/85 hover:bg-white/5",
                  ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  rightLinkText?: string;
  onRightLinkClick?: () => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <div className="text-xs font-semibold tracking-widest text-white/70">
          {props.label}
        </div>
        <div className="flex-1" />
        {props.rightLinkText && props.onRightLinkClick ? (
          <button
            type="button"
            onClick={props.onRightLinkClick}
            className="text-xs text-white/70 underline underline-offset-4 hover:text-white"
          >
            {props.rightLinkText}
          </button>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}