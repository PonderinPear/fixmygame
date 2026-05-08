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
      pickScanFolder?: (defaultPath?: string) => Promise<string | null>;
      scanCustomFolder?: (
  folderPath: string,
  gameKey?: string
) => Promise<
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
detectGameInstall?: (gameKey: string) => Promise<{
  ok?: boolean;
  detected?: boolean;
  path?: string | null;
  error?: string;
}>;
detectSystemSpecs?: () => Promise<{
  ok?: boolean;
  gpuModel?: string;
  driverVersion?: string;
  graphicsApiMode?: string;
  error?: string;
}>;
closeApp?: () => Promise<{
  ok?: boolean;
  error?: string;
}>;
findMissingModOnDevice?: (payload: {
  gameKey: string;
  modName: string;
}) => Promise<MissingModRecoveryResult>;

moveFoundModToModsFolder?: (payload: {
  gameKey: string;
  modName: string;
  sourcePath: string;
}) => Promise<{
  moved: boolean;
  alreadyInCorrectPlace?: boolean;
  sourcePath: string;
  destinationPath: string;
}>;

openExternalUrl?: (url: string) => Promise<{ opened: boolean }>;
applySafeFix?: (payload: {
  gameKey: string;
  installPath: string;
  suspectMods?: string[];
  actionLabel?: string;
}) => Promise<{
  ok?: boolean;
  error?: string;
  movedFile?: string;
  matchedName?: string;
  matchedSuspect?: string;
  itemType?: "file" | "folder";
  candidateKind?: "empty_folder" | "invalid_loose_file" | "mod_file" | "mod_folder";
  originalPath?: string;
  backupPath?: string;
  quarantinePath?: string;
  entry?: {
    id: string;
    createdAt: string;
    gameKey: string;
    actionLabel: string;
    suspectMods: string[];
    originalPath: string;
    backupPath: string;
    quarantinePath: string;
    fileName: string;
    matchedName?: string;
    matchedSuspect?: string;
    installPath?: string;
    modsFolder?: string;
    itemType?: string;
    candidateKind?: string;
    status: string;
  };
}>;

undoLastFix?: () => Promise<{
  ok?: boolean;
  error?: string;
  restoredFile?: string;
  originalPath?: string;
}>;
copyText?: (text: string) => Promise<{
        ok?: boolean;
        error?: string;
      }>;
    };
  }
}

type MissingModRecoveryResult = {
  found: boolean;
  foundPath: string;
  expectedPath: string;
  allMatches?: {
    path: string;
    itemType: "file" | "folder";
    candidateKind: "mod_folder" | "mod_file" | "archive_file";
    name: string;
  }[];
  alreadyInCorrectPlace?: boolean;
  justMovedToCorrectPlace?: boolean;
  searchedRoots?: string[];
  foundItemType?: string;
  foundCandidateKind?: string;
};

type LimitResponse = {
  isPro: boolean;
  remaining: number;
  limit: number;
  isBeta?: boolean;
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
      advisoryLevel?: "none" | "advisory" | "important";
      advisoryTitle?: string;
      advisoryMessage?: string;
    };
  };
  detectedSignals?: {
  errorType?: string;
  loader?: string;
  gameVersion?: string;
  javaVersion?: string;
  suspectedMods?: string[];
  likelyCategory?: string;
  advisoryLevel?: "none" | "advisory" | "important";
  advisoryTitle?: string;
  advisoryMessage?: string;
};
};

type CheckoutResponse = {
  url: string;
};

type FixAction = {
  id: string;
  type: "open_mods_folder" | "open_logs_folder" | "copy_fix_steps";
  title: string;
  description: string;
  risk: "low" | "medium" | "high";
  reversible: boolean;
};

type FixExecutionResult = {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
};

type FixPlan = {
  title: string;
  description: string;
  actions: FixAction[];
};

type FixHistoryItem = {
  id: string;
  createdAt: number;
  gameKey: string;
  gameTitle: string;
  type:
    | "quick_fix"
    | "full_result"
    | "suspected_mods"
    | "fix_plan"
    | "diagnostic_run";
  title: string;
  text: string;
  analysisSummary?: {
    issue?: string;
    quickFixFirst?: string;
    mostLikelyCause?: string;
    needMoreInfo?: string;
    likelyCategory?: string;
    suspectedMods?: string[];
    previousRelevantLog?: string;
  };
};

type ApiErrorShape = {
  error?: string;
  message?: string;
};

function isApiErrorShape(x: unknown): x is ApiErrorShape {
  return typeof x === "object" && x !== null;
}

const FIX_HISTORY_STORAGE_KEY = "fmg_fix_history";
const APP_AUTH_STORAGE_KEY = "fmg_authorized_device_v2";
const SYSTEM_PREFS_STORAGE_KEY = "fixmygame:last-system-prefs";
const SUPPORT_TELEMETRY_STORAGE_KEY = "fixmygame:support-telemetry-enabled";

const APP_SETTINGS_STORAGE_KEY = "fixmygame:app-settings";

type AppSettings = {
  enableSafeFix: boolean;
  askBeforeFixing: boolean;
  createBackupBeforeFix: boolean;
  autoDetectGames: boolean;
  rememberLastGamePath: boolean;
  showAdvancedDetails: boolean;
  highlightSuspiciousLine: boolean;
  showProbabilityBreakdown: boolean;
  saveFixHistory: boolean;
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  enableSafeFix: true,
  askBeforeFixing: true,
  createBackupBeforeFix: true,
  autoDetectGames: true,
  rememberLastGamePath: true,
  showAdvancedDetails: true,
  highlightSuspiciousLine: true,
  showProbabilityBreakdown: true,
  saveFixHistory: true,
};

function loadFixHistory(): FixHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FIX_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as FixHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFixHistory(items: FixHistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FIX_HISTORY_STORAGE_KEY, JSON.stringify(items));
}

function pushFixHistoryItem(item: FixHistoryItem) {
  const current = loadFixHistory();
  const next = [item, ...current].slice(0, 50);
  saveFixHistory(next);
  return next;
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

function getFixPlan(
  gameKey: string,
  gameTitle: string,
  analysis: AnalyzeResponse["analysis"] | null,
  detectedSignals: AnalyzeResponse["detectedSignals"] | null,
  selectedGameProfile: {
    label: string;
    supportsAutoDetect: boolean;
    supportsModsFolder: boolean;
    supportsLogsFolder: boolean;
  }
): FixPlan | null {
  if (!analysis) return null;

  const actions: FixAction[] = [];

  if (selectedGameProfile.supportsModsFolder) {
    actions.push({
      id: "open_mods_folder",
      type: "open_mods_folder",
      title: `Open ${gameTitle} mods folder`,
      description:
        "Open the local mods folder so you can review, disable, or remove suspected mods.",
      risk: "low",
      reversible: false,
    });
  }

  if (selectedGameProfile.supportsLogsFolder) {
    actions.push({
      id: "open_logs_folder",
      type: "open_logs_folder",
      title: `Open ${gameTitle} logs folder`,
      description:
        "Open the local crash/logs folder so you can inspect logs or compare future crashes.",
      risk: "low",
      reversible: false,
    });
  }

  actions.push({
    id: "copy_fix_steps",
    type: "copy_fix_steps",
    title: "Copy recommended fix steps",
    description:
      "Copy the exact Quick Fix and recommended repair steps to your clipboard.",
    risk: "low",
    reversible: false,
  });

  const category = detectedSignals?.likelyCategory ?? "unknown";

  return {
    title:
      category === "missing_dependency"
        ? "Missing dependency repair preview"
        : category === "mixin_failure"
        ? "Mixin failure repair preview"
        : category === "java_mismatch"
        ? "Java mismatch repair preview"
        : category === "loader_mismatch"
        ? "Loader mismatch repair preview"
        : category === "mod_conflict"
        ? "Safe repair preview"
        : "Repair preview",
    description: getFixPlanDescription(category),
    actions,
  };
}

function getFixPlanDescription(category: string) {
  if (category === "missing_dependency") {
    return "FixMyGame found a missing required mod or dependency. Use the download button to open the correct mod page, then install it into your Mods folder.";
  }

  if (category === "mod_conflict") {
    return "Backs up and quarantines the likely problem mod.";
  }

  if (category === "loader_mismatch") {
    return "This result needs a manual version fix. Update the plugin, loader, or framework so everything matches the same game runtime.";
  }

  if (category === "game_files_corrupt") {
    return "This result needs a manual game-file repair. Verify or reinstall the game files before removing mods.";
  }

  if (category === "java_mismatch") {
    return "This result needs a manual Java/runtime fix. Install the required Java version and point your launcher to it.";
  }

  if (category === "mixin_failure") {
  return "A mod failed while patching Minecraft. Update the mod named in the error, or temporarily remove it if no compatible update exists.";
}

  return "Follow the recommended steps below. Automatic repair is not available for this result yet.";
}

function getRiskClasses(risk: FixAction["risk"]) {
  if (risk === "low") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (risk === "medium") {
    return "border-yellow-400/20 bg-yellow-400/10 text-yellow-200";
  }

  return "border-red-400/20 bg-red-400/10 text-red-200";
}

function detectModManagerFromPath(inputPath?: string) {
  const rawPath = String(inputPath || "");
  const lower = rawPath.toLowerCase();

  if (!rawPath.trim()) return null;

  if (lower.includes("\\curseforge\\minecraft\\instances\\")) {
    const profileName =
      rawPath.split("Instances\\")[1]?.split("\\")[0] ||
      rawPath.split("instances\\")[1]?.split("\\")[0] ||
      null;

    return {
      manager: "CurseForge",
      profileName,
    };
  }

  if (lower.includes("\\prismlauncher\\instances\\")) {
    const profileName =
      rawPath.split("instances\\")[1]?.split("\\")[0] || null;

    return {
      manager: "Prism Launcher",
      profileName,
    };
  }

  if (lower.includes("\\modrinthapp\\profiles\\")) {
    const profileName =
      rawPath.split("profiles\\")[1]?.split("\\")[0] || null;

    return {
      manager: "Modrinth",
      profileName,
    };
  }

  if (lower.includes("\\multimc\\instances\\")) {
    const profileName =
      rawPath.split("instances\\")[1]?.split("\\")[0] || null;

    return {
      manager: "MultiMC",
      profileName,
    };
  }

  return null;
}

function getSmartFixPath(
  signals: AnalyzeResponse["detectedSignals"] | null,
  analysis: AnalyzeResponse["analysis"] | null,
  gameKey: string,
  currentLogPath?: string,
  crashLog?: string
) {
  const category = signals?.likelyCategory ?? "unknown";
  const loader = signals?.loader ?? "";
  const javaVersion = signals?.javaVersion ?? "";
  const mods = signals?.suspectedMods ?? [];

  const lowerLogPath = String(currentLogPath || "").toLowerCase();

  const stardewModsPath =
  lowerLogPath.includes("\\stardewvalley\\errorlogs")
    ? "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley\\Mods"
    : "";

  const managerInfo = detectModManagerFromPath(currentLogPath);

  const lowerCrashLog = String(crashLog || "").toLowerCase();

const stardewSkippedEmptyFolderMatch =
  crashLog?.match(/-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's an empty folder\./i) ||
  crashLog?.match(/TRACE SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\(from Mods\\[^)]*\)\.\.\.[\s\S]*?Failed:\s+it's an empty folder\./i);

const stardewSkippedEmptyFolderMod =
  stardewSkippedEmptyFolderMatch?.[1]?.trim() || null;
  const stardewBrokenFolderPath =
  stardewModsPath && stardewSkippedEmptyFolderMod
    ? `${stardewModsPath}\\${stardewSkippedEmptyFolderMod}`
    : "";
  // GAME-SPECIFIC HANDLING FIRST

  if (gameKey === "stardew_valley") {
  const leadMod = mods[0] || "the installer folder";

  if (
  lowerCrashLog.includes("skipped mods") &&
  lowerCrashLog.includes("empty folder")
) {
  const badFolder = stardewSkippedEmptyFolderMod || mods[0] || "the empty mod folder";

  return {
    title: "Unused or invalid Stardew mod folder found",
    bullets: [
      `${badFolder} was skipped by SMAPI because it is an empty folder.`,
      stardewBrokenFolderPath
        ? `Remove this folder: ${stardewBrokenFolderPath}`
        : `Remove the empty folder named ${badFolder} from your Stardew Valley Mods folder.`,
      "This is not a game crash, but cleaning it up will make the log clearer.",
    ],
  };
}

    if (isAdvisoryCategory(category)) {
  return {
    title: analysis?.issue || "Advisory issue found",
    bullets: [
      analysis?.quickFixFirst || "A non-fatal issue was found in this log.",
      analysis?.mostLikelyCause || "The game may still launch, but this warning should be cleaned up.",
      ...(analysis?.recommendedFixSteps?.length
        ? analysis.recommendedFixSteps
        : ["Review the warning and apply the suggested cleanup."]),
    ],
  };
}

if (category === "game_files_corrupt") {
  return {
    title: "Game files missing or corrupted",
    bullets: [
      analysis?.quickFixFirst || "Verify Stardew Valley’s game files through Steam.",
      analysis?.mostLikelyCause ||
        "A required Stardew Valley Content file is missing or corrupted.",
      "Do not remove mods yet — this result points to missing base game files, not a mod conflict.",
      "After Steam finishes verifying files, launch Stardew Valley again and load the newest log if it still fails.",
    ],
  };
}

if (category === "no_clear_issue_found") {
  return {
    title: "No clear issue found in this log",
      bullets: [
        "This log looks normal and does not show an active crash or broken mod.",
        "Launch Stardew Valley again and test normally.",
        "If the issue returns, load the newest crash or error log created after the problem happens.",
        "If the problem is intermittent, re-run FixMyGame immediately after it appears.",
      ],
    };
  }

  if (
    analysis?.quickFixFirst?.toLowerCase().includes("smapi") ||
    analysis?.issue?.toLowerCase().includes("installer folder") ||
    analysis?.issue?.toLowerCase().includes("non-mod installer")
  ) {
    const bullets: string[] = [];

    if (managerInfo?.manager && managerInfo?.profileName) {
      bullets.push(
        `Option A — Fix in ${managerInfo.manager}: Open ${managerInfo.manager}, open "${managerInfo.profileName}", find "${leadMod}", then disable or remove it there.`
      );
    }

    bullets.push(
      `Fix in Mods Folder: Delete the "${leadMod}" folder from your Mods folder.`
    );

    bullets.push(
      stardewModsPath
        ? `Mods folder: ${stardewModsPath}`
        : "Open your Stardew Valley Mods folder and locate the installer folder."
    );

    bullets.push(
      "Restart Stardew Valley and check whether your mods load normally."
    );

    bullets.push(
      "If the issue continues, run another diagnostic after reopening the game."
    );

    return {
      title: "Installer folder found in Mods",
      bullets,
    };
  }

  const fallbackBullets: string[] = [];

  if (managerInfo?.manager && managerInfo?.profileName && mods.length > 0) {
    fallbackBullets.push(
      `Option A — Fix in ${managerInfo.manager}: Open ${managerInfo.manager}, open "${managerInfo.profileName}", find "${mods[0]}", and disable it there first.`
    );
  }

  fallbackBullets.push(
    mods.length > 0
      ? `Fix in Mods Folder: Start by removing or disabling ${mods[0]}.`
      : "Fix in Mods Folder: Start by removing the most recently added mod."
  );

  fallbackBullets.push(
    "Make sure each mod is properly installed (not just extracted or incomplete files)."
  );

  fallbackBullets.push(
    "Restart Stardew Valley and check whether the issue is gone."
  );

  fallbackBullets.push(
    "If the issue continues, re-run FixMyGame after the next launch."
  );

  return {
    title: "Mod conflict likely",
    bullets: fallbackBullets,
  };
}

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

if (gameKey === "cyberpunk2077") {
  if (category === "missing_dependency") {
  return {
    title: "Missing Dependency (Cyberpunk 2077)",
    bullets: [
      mods.length > 0
        ? `${mods[0]} is missing a required dependency (like Codeware or ArchiveXL).`
        : "A required mod dependency is missing.",
      "Install the missing dependency (Codeware, ArchiveXL, RED4ext, or CET depending on the mod).",
      "Make sure all framework mods are up to date and match your Cyberpunk version.",
      "Restart the game after installing the dependency.",
    ],
  };
}
  if (isAdvisoryCategory(category)) {
  return {
    title: analysis?.issue || "Advisory issue found",
    bullets: [
      analysis?.quickFixFirst || "A non-fatal issue was found in this log.",
      analysis?.mostLikelyCause || "The game may still launch, but this warning should be cleaned up.",
      ...(analysis?.recommendedFixSteps?.length
        ? analysis.recommendedFixSteps
        : ["Review the warning and apply the suggested cleanup."]),
    ],
  };
}

if (category === "no_clear_issue_found") {
  return {
    title: "No clear issue found in this log",
      bullets: [
        "This Cyberpunk 2077 log looks normal and does not show an active crash or broken framework.",
        "Launch the game again and test normally.",
        "If the issue returns, load the newest crash or error log created after the problem happens.",
        "If the issue is intermittent, re-run FixMyGame immediately after it appears.",
      ],
    };
  }

  if (category === "gpu_driver_issue") {
    return {
      title: "Graphics / Driver Issue (Cyberpunk 2077)",
      bullets: [
        "Disable graphics-heavy mods, overlays, and reshade-like tools first.",
        "Update your GPU driver to the latest stable version.",
        "Retest without RED4ext, CET-dependent visual tweaks, or heavy archive mods.",
        "Re-enable visual mods one at a time after stability returns.",
      ],
    };
  }

  return {
    title: "Cyberpunk Mod / Framework Issue",
    bullets: [
      "Update RED4ext, redscript, Cyber Engine Tweaks, and ArchiveXL first.",
      mods.length > 0
        ? `Disable or remove ${mods[0]} first, then retest.`
        : "Disable the most recently added Cyberpunk mod first, then retest.",
      "Make sure all core frameworks match your current Cyberpunk version.",
      "Retest after each single change so you can isolate the unstable mod or framework.",
    ],
  };
}

if (gameKey === "baldurs_gate_3") {
  if (isAdvisoryCategory(category)) {
  return {
    title: analysis?.issue || "Advisory issue found",
    bullets: [
      analysis?.quickFixFirst || "A non-fatal issue was found in this log.",
      analysis?.mostLikelyCause || "The game may still launch, but this warning should be cleaned up.",
      ...(analysis?.recommendedFixSteps?.length
        ? analysis.recommendedFixSteps
        : ["Review the warning and apply the suggested cleanup."]),
    ],
  };
}

if (category === "no_clear_issue_found") {
  return {
    title: "No clear issue found in this log",
      bullets: [
        "This Baldur's Gate 3 log looks normal and does not show an active mod or Script Extender failure.",
        "Launch the game again and test normally.",
        "If the issue returns, load the newest crash or error log created after the problem happens.",
        "If the issue is intermittent, re-run FixMyGame immediately after it appears.",
      ],
    };
  }

  return {
    title: "BG3 Mod / Script Extender Issue",
    bullets: [
      "Update Baldur's Gate 3 Script Extender and BG3 Mod Manager first.",
      mods.length > 0
        ? `Disable or remove ${mods[0]} first, then retest.`
        : "Disable the most recently added BG3 mod first, then retest.",
      "Make sure your .pak mods and ModSettings file match your current game version.",
      "If the issue continues, test with Script Extender only, then re-enable mods one at a time.",
    ],
  };
}

if (gameKey === "project_zomboid") {
  if (isAdvisoryCategory(category)) {
  return {
    title: analysis?.issue || "Advisory issue found",
    bullets: [
      analysis?.quickFixFirst || "A non-fatal issue was found in this log.",
      analysis?.mostLikelyCause || "The game may still launch, but this warning should be cleaned up.",
      ...(analysis?.recommendedFixSteps?.length
        ? analysis.recommendedFixSteps
        : ["Review the warning and apply the suggested cleanup."]),
    ],
  };
}

if (category === "no_clear_issue_found") {
  return {
    title: "No clear issue found in this log",
      bullets: [
        "This Project Zomboid log looks normal and does not show an active Lua or workshop mod failure.",
        "Launch the game again and test normally.",
        "If the issue returns, load the newest crash or error log created after the problem happens.",
        "If the issue is intermittent, re-run FixMyGame immediately after it appears.",
      ],
    };
  }

  if (category === "missing_dependency") {
    return {
      title: "Missing Project Zomboid mod requirement",
      bullets: [
        mods.length > 0
          ? `${mods[0]} may need another required mod or workshop dependency.`
          : "One of your active Zomboid mods may be missing a required dependency.",
        "Install the missing dependency and make sure it matches your current Project Zomboid version.",
        "Check whether the mod page lists required workshop items or libraries.",
        "Restart the game after installing the missing requirement.",
      ],
    };
  }

  if (category === "loader_mismatch") {
    return {
      title: "Workshop / version mismatch",
      bullets: [
        "One or more workshop mods may not match your current Project Zomboid build.",
        "Update all workshop mods first, then retest.",
        "Disable recently added or outdated mods until the crash stops.",
        "Make sure all active mods are built for the same Project Zomboid version.",
      ],
    };
  }

  return {
    title: "Project Zomboid Mod / Lua Error",
    bullets: [
      mods.length > 0
        ? `Disable or update ${mods[0]} first, then relaunch the game.`
        : "Disable or update the most recently added workshop mod first, then relaunch the game.",
      "Check for Lua errors, workshop mismatches, or failed mod loads in the log.",
      "Verify that all workshop mods are updated and match your current Project Zomboid version.",
      "If the issue continues, re-enable mods one at a time until the crash returns.",
    ],
  };
}

  if (gameKey === "custom") {
    return {
      title: analysis?.issue || "Custom game / unsupported log",
      bullets: [
        analysis?.quickFixFirst ||
          "Start with the first clear error, exception, or failed plugin/mod line in the log.",
        mods.length > 0
          ? `Start by testing without ${mods[0]}.`
          : "Remove or disable the most recently added mod/plugin first.",
        "Check version compatibility between the game, mods/plugins, loaders, and required frameworks.",
        "If the issue still is not clear, load a newer log created immediately after reproducing the problem.",
      ],
    };
  }

  switch (category) {
    case "java_mismatch":
  return {
    title: "Java version mismatch detected",
    bullets: [
      "Install Java 17 or the version required by your modpack.",
      loader
        ? `Set the ${loader} launcher to use the new Java version.`
        : "Set your launcher to use the new Java version.",
      javaVersion
        ? `Current detected Java: ${javaVersion} (too old)`
        : "Your current Java version may be too old.",
      "Relaunch the game after updating Java.",
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
      "Lower shader quality or resolution before removing the shader pack.",
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
    case "no_clear_issue_found":
      return {
        title: "No clear issue found in this log",
        bullets: [
          "This log looks normal and does not show an active crash or broken mod.",
          "Launch the game again and test normally.",
          "If the issue returns, load the newest crash or error log created after the problem happens.",
          "If the problem is visual, performance-related, or intermittent, re-run FixMyGame right after it appears.",
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

function buildSmartFixResultOverride({
  gameKey,
  crashLog,
  analysis,
  detectedSignals,
}: {
  gameKey: string;
  crashLog: string;
  analysis: AnalyzeResponse["analysis"] | null;
  detectedSignals: AnalyzeResponse["detectedSignals"] | null;
}): AnalyzeResponse["analysis"] | null {
  const category =
    analysis?.detectedSignals?.likelyCategory ||
    detectedSignals?.likelyCategory ||
    "";

  const lowerCrashLog = String(crashLog || "").toLowerCase();

  if (
    gameKey === "stardew_valley" &&
    category === "no_clear_issue_found" &&
    lowerCrashLog.includes("skipped mods") &&
    lowerCrashLog.includes("empty folder")
  ) {
    const modMatch =
      crashLog.match(/-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's an empty folder\./i) ||
      crashLog.match(/TRACE SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\(from Mods\\[^)]*\)\.\.\.[\s\S]*?Failed:\s+it's an empty folder\./i);

    const badFolder = modMatch?.[1]?.trim() || "the empty mod folder";

    return {
      quickFixFirst: `You can delete the empty folder for ${badFolder} to clean up the warning.`,
      issue: `There's an empty folder for ${badFolder} in your Mods folder, which is causing a warning.`,
      confidenceLevel: "High",
      probabilityBreakdown: [
        `100% - The empty folder for ${badFolder} is the only issue.`,
      ],
      mostLikelyCause: `The empty folder for ${badFolder} is not being recognized as a valid mod.`,
      recommendedFixSteps: [
        `Delete the empty folder for ${badFolder} from your Mods folder.`,
        "Launch Stardew Valley again after removing it so SMAPI creates a fresh log.",
        "Load the newest SMAPI log created after that launch to confirm the warning is gone.",
      ],
      needMoreInfo:
        "If you still see the same warning after removing it, you may be looking at an older log. Launch the game again and load the newest SMAPI log.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        suspectedMods: [badFolder],
        likelyCategory: "advisory_empty_folder",
        advisoryLevel: "advisory",
        advisoryTitle: "Empty mod folder found",
        advisoryMessage: `${badFolder} is an empty folder. This is not a crash, but it should be removed to clean up the warning.`,
      },
    };
  }

  return null;
}

function buildUniversalFallbackOverride({
  gameTitle,
  crashLog,
  analysis,
  detectedSignals,
}: {
  gameTitle: string;
  crashLog: string;
  analysis: AnalyzeResponse["analysis"] | null;
  detectedSignals: AnalyzeResponse["detectedSignals"] | null;
}): AnalyzeResponse["analysis"] | null {
  const lowerCrashLog = String(crashLog || "").toLowerCase();

  const skyrimRuntimeMismatchMatch = crashLog.match(
  /plugin\s+([A-Za-z0-9_.-]+\.dll)[\s\S]*?reported as incompatible[\s\S]*?expected runtime\s+([0-9.]+),\s*got\s+([0-9.]+)/i
);

if (gameTitle === "Skyrim Special Edition" && skyrimRuntimeMismatchMatch) {
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
    mostLikelyCause: `${pluginName} does not match your current Skyrim/SKSE runtime version.`,
    recommendedFixSteps: [
      `Download the version of ${pluginName} made for Skyrim runtime ${currentRuntime}.`,
      `Replace the old ${pluginName} file in your SKSE Plugins folder.`,
      "Make sure SKSE, Address Library, and DLL plugins all match the same Skyrim runtime.",
      "Relaunch Skyrim after updating the plugin.",
    ],
    needMoreInfo:
      "If the crash continues, provide the updated SKSE log and exact Skyrim runtime/SKSE versions.",
    detectedSignals: {
      ...(analysis?.detectedSignals || detectedSignals || {}),
      errorType: "SkyrimRuntimeMismatch",
      loader: "SKSE / Mod Manager",
      gameVersion: currentRuntime,
      javaVersion: "",
      suspectedMods: [pluginName.replace(/\.dll$/i, ""), "skse"],
      likelyCategory: "loader_mismatch",
    },
  };
}

  const isStardewBaseGameFileMissing =
  gameTitle === "Stardew Valley" &&
  lowerCrashLog.includes("filenotfoundexception") &&
  lowerCrashLog.includes("content\\") &&
  (lowerCrashLog.includes(".xnb") || lowerCrashLog.includes(".xgs"));

if (isStardewBaseGameFileMissing) {
  return {
    quickFixFirst: "Verify Stardew Valley’s game files through Steam.",
    issue:
      "Stardew Valley is missing or unable to load a required base game file.",
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
      "Launch Stardew Valley again after Steam finishes.",
    ],
    needMoreInfo:
      "If verifying files does not fix it, reinstall Stardew Valley or load the newest SMAPI log after the next failed launch.",
    detectedSignals: {
      ...(analysis?.detectedSignals || detectedSignals || {}),
      loader: "SMAPI",
      likelyCategory: "game_files_corrupt",
      suspectedMods: [],
      errorType: "FileNotFoundException",
    },
  };
}

  if (!analysis && !detectedSignals) {
    return {
      quickFixFirst: `Start by checking the newest ${gameTitle} log for the first clear error or failed mod/plugin line.`,
      issue: `FixMyGame could not build a strong diagnosis from this ${gameTitle} log yet.`,
      confidenceLevel: "Low",
      probabilityBreakdown: [
        "45% - Incomplete or non-crash log",
        "35% - Mod/plugin conflict",
        "20% - Environment or setup issue",
      ],
      mostLikelyCause:
        "The current log may be incomplete, non-fatal, or missing the line that shows the actual failure.",
      recommendedFixSteps: [
        `Launch ${gameTitle} again and reproduce the issue.`,
        "Load the newest crash or error log created after the issue happens.",
        "Remove the most recently added mod/plugin first if the problem started after installing something new.",
      ],
      needMoreInfo:
        "If the issue continues, provide a newer crash log or describe exactly what is still happening in the refinement box.",
      detectedSignals: {
  likelyCategory: "unknown",
},
    };
  }

  const likelyCategory =
    analysis?.detectedSignals?.likelyCategory ||
    detectedSignals?.likelyCategory ||
    "";

  const weakIssue =
    !analysis?.issue ||
    analysis.issue.toLowerCase().includes("unknown") ||
    analysis.issue.toLowerCase().includes("unclear");

  const weakCause =
    !analysis?.mostLikelyCause ||
    analysis.mostLikelyCause.toLowerCase().includes("unknown") ||
    analysis.mostLikelyCause.toLowerCase().includes("unclear");

  const weakSteps =
    !analysis?.recommendedFixSteps ||
    analysis.recommendedFixSteps.length === 0;

  const noClearIssue =
    likelyCategory === "no_clear_issue_found" &&
    (
      lowerCrashLog.includes("error") ||
      lowerCrashLog.includes("exception") ||
      lowerCrashLog.includes("failed") ||
      lowerCrashLog.includes("traceback") ||
      lowerCrashLog.includes("missing dependency")
    );

  if (!weakIssue && !weakCause && !weakSteps && !noClearIssue) {
    return null;
  }

  const suspects =
    analysis?.detectedSignals?.suspectedMods ||
    detectedSignals?.suspectedMods ||
    [];

  const leadSuspect = suspects[0] || "the most recently added mod/plugin";

  return {
    quickFixFirst:
      analysis?.quickFixFirst ||
      `Temporarily disable ${leadSuspect} first, then test again.`,
    issue:
      weakIssue
        ? `FixMyGame found signs of a ${gameTitle} mod, plugin, or setup issue, but the exact failure is not fully confirmed from this log.`
        : analysis!.issue,
    confidenceLevel:
      analysis?.confidenceLevel || "Medium",
    probabilityBreakdown:
      analysis?.probabilityBreakdown?.length
        ? analysis.probabilityBreakdown
        : [
            "50% - Mod/plugin conflict",
            "30% - Missing dependency or version mismatch",
            "20% - Wrong or incomplete log",
          ],
    mostLikelyCause:
      noClearIssue
        ? `The warnings shown are normal SMAPI advisory notes, not confirmed crash causes.`
        : weakCause
        ? `A mod/plugin conflict, missing dependency, version mismatch, or incomplete install is more likely than a clean/no-issue state.`
        : analysis!.mostLikelyCause,
    recommendedFixSteps:
      weakSteps
        ? [
            `Disable or remove ${leadSuspect} first, then test again.`,
            "Check that all mods/plugins match your exact game version.",
            "Install any missing required dependency/framework mods.",
            "If the problem continues, load the newest crash or error log created after the issue happens.",
          ]
        : analysis!.recommendedFixSteps,
    needMoreInfo:
      analysis?.needMoreInfo ||
      "If this result still feels too generic, use Continue Diagnostic or Still Crashing and describe exactly what the app missed.",
    detectedSignals: {
      ...(analysis?.detectedSignals || detectedSignals || {}),
      suspectedMods: suspects,
      likelyCategory: likelyCategory || "unknown",
    },
  };
}

function buildLoadedLogSummary({
  crashLog,
}: {
  crashLog: string;
}) {
  const text = String(crashLog || "");
  if (!text.trim()) return "";

  const lines = text.split(/\r?\n/);

  let modCount = 0;

  const smapiModLineMatch = text.match(/Loaded\s+(\d+)\s+mods?/i);
  if (smapiModLineMatch) {
    modCount = Number(smapiModLineMatch[1]) || 0;
  }

  if (!modCount) {
    const stardewModMatches = text.match(/\(from Mods\\/gi);
    modCount = stardewModMatches ? stardewModMatches.length : 0;
  }

  const warningKeys = new Set<string>();

  for (const line of lines) {
    const lower = line.toLowerCase();

    const emptyFolderMatch =
      line.match(/-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's an empty folder\./i) ||
      line.match(/TRACE SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\(from Mods\\[^)]*\)\.\.\.[\s\S]*?Failed:\s+it's an empty folder\./i);

    if (emptyFolderMatch?.[1]) {
      warningKeys.add(`empty-folder:${emptyFolderMatch[1].trim().toLowerCase()}`);
      continue;
    }

    if (lower.includes("skipped mods")) {
      warningKeys.add("skipped-mods");
      continue;
    }

    if (/\bwarn(?:ing)?\b/i.test(line)) {
      const normalized = lower.replace(/\s+/g, " ").trim();
      warningKeys.add(`warning:${normalized}`);
    }
  }

  const warningCount = warningKeys.size;

  const modLabel =
    modCount === 1 ? "1 mod detected" : `${modCount} mods detected`;

  const warningLabel =
    warningCount === 1 ? "1 warning found" : `${warningCount} warnings found`;

  return `Loaded latest log • ${modLabel} • ${warningLabel}`;
}

function isAdvisoryCategory(category?: string) {
  return [
    "advisory_skipped_mod",
    "advisory_empty_folder",
    "advisory_optional_dependency",
    "advisory_workshop_warning",
    "advisory_partial_load",
  ].includes(String(category || ""));
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
      case "no_clear_issue_found":
        return "No Clear Issue Found";
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

    if (gameKey === "cyberpunk2077") {
    switch (category) {
      case "mod_conflict":
        return "Framework / Mod Conflict";
      case "missing_dependency":
        return "Missing Core Framework";
      case "gpu_driver_issue":
        return "Graphics / Driver Issue";
      case "no_clear_issue_found":
        return "No Clear Issue Found";
      default:
        return category
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
    }
  }

  if (gameKey === "baldurs_gate_3") {
    switch (category) {
      case "mod_conflict":
        return "BG3 Mod Conflict";
      case "missing_dependency":
        return "Missing BG3 Requirement";
      case "loader_mismatch":
        return "Script Extender / Mod Mismatch";
      case "no_clear_issue_found":
        return "No Clear Issue Found";
      default:
        return category
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
    }
  }

    if (gameKey === "project_zomboid") {
    switch (category) {
      case "mod_conflict":
        return "Workshop / Lua Conflict";
      case "missing_dependency":
        return "Missing Mod Requirement";
      case "loader_mismatch":
        return "Workshop Version Mismatch";
      case "no_clear_issue_found":
        return "No Clear Issue Found";
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
    case "game_files_corrupt":
      return "Game Files Missing";
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
    case "runtime_disconnect":
      return "Runtime Disconnect";
    case "network_mod_failure":
      return "Network / Session Mod Failure";
    case "game_files_corrupt":
      return "Game Files Missing";
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

    if (gameKey === "fallout_new_vegas") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "NVSE / Plugin Detection",
      "Smart Fix Paths",
    ];
  }

    if (gameKey === "slime_rancher" || gameKey === "slime_rancher_2") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "Mod / Plugin Detection",
      "Smart Fix Paths",
    ];
  }
      if (gameKey === "cyberpunk2077") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "REDmod / Framework Detection",
      "Smart Fix Paths",
    ];
  }

  if (gameKey === "baldurs_gate_3") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "BG3 Mod / Script Extender Detection",
      "Smart Fix Paths",
    ];
  }

  if (gameKey === "project_zomboid") {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "Workshop / Lua Detection",
      "Smart Fix Paths",
    ];
  }

  if (
    gameKey === "witcher3" ||
    gameKey === "seven_days_to_die" ||
    gameKey === "xcom2"
  ) {
    return [
      "Desktop Scanner",
      "AI Diagnostic Engine",
      "Mod / Plugin Detection",
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

    if (
    lower.includes("mods loaded and ready!") &&
    lower.includes("all mods up to date.") &&
    lower.includes("disconnected: closedgame") &&
    !lower.includes(" error ") &&
    !lower.includes("exception")
  ) {
    return {
      status: "No clear issue",
      session: "Normal log",
      loader: null,
      java: null,
      issue: null,
      error: null,
    };
  }

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

    let error: string | null = null;
    let issue: string | null = null;

if (lower.includes("unsupportedclassversionerror")) {
  error = "UnsupportedClassVersionError";
  issue = "Java version mismatch";
} else if (lower.includes("unsupported class file major version")) {
  error = "UnsupportedClassVersionError";
  issue = "Java version mismatch";
} else if (lower.includes("outofmemoryerror")) {
  error = "OutOfMemoryError";
  issue = "Out of memory";
} else if (lower.includes("nosuchmethoderror")) {
  error = "NoSuchMethodError";
  issue = "Mod version conflict";
} else if (lower.includes("classnotfoundexception")) {
  error = "ClassNotFoundException";
  issue = "Missing mod or dependency";
} else if (lower.includes("invalidinjectionexception")) {
  error = "InvalidInjectionException";
  issue = "Mixin injection failure";
} else if (lower.includes("mixintransformererror")) {
  error = "MixinTransformerError";
  issue = "Mixin transformation failure";
} else {
  const rawError =
    log.match(/([A-Za-z0-9_.]*(Exception|Error))(?::\s*[^\n]*)?/i)?.[1]?.trim() ||
    null;

  error =
    rawError?.toLowerCase() === "error"
      ? "UnknownError"
      : rawError;

  if (error === "UnknownError") {
  issue = "Unknown issue";
} else if (error === "RuntimeException") {
  issue = "Runtime failure";
} else if (error === "IllegalArgumentException") {
  issue = "Invalid game or mod input";
} else if (error === "UnsupportedClassVersionError") {
  issue = "Java version mismatch";
} else if (error === "OutOfMemoryError") {
  issue = "Out of memory";
} else {
  issue = "Game crash detected";
}
}

return {
  loader,
  java,
  issue,
  error,
};
  }
  if (gameKey === "stardew_valley") {
  let issue: string | null = null;
  let error: string | null = null;

  if (lower.includes("skipped mods") && lower.includes("empty folder")) {
    issue = "Skipped empty mod folder";
    error = "SkippedMod";
  } else if (lower.includes("skipped mods")) {
    issue = "Skipped mod";
    error = "SkippedMod";
  } else if (lower.includes("missing dependency")) {
    issue = "Missing dependency";
    error = "MissingDependency";
  } else if (lower.includes("because it's an empty folder")) {
    issue = "Empty mod folder";
    error = "EmptyFolder";
  } else if (lower.includes("failed")) {
    issue = "Stardew mod issue";
    error = "Failed";
  } else if (lower.includes("error")) {
    issue = "Stardew log warning";
    error = "Error";
  }

  return {
    loader: "SMAPI",
    java: null,
    issue,
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
      issue: error ? "Script Mod Issue" : null,
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
      issue: error ? "Plugin or SKSE Issue" : null,
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
      issue: error ? "Plugin or F4SE Issue" : null,
      error,
    };
  }

    if (gameKey === "cyberpunk2077") {
  const error =
    log.match(/(error|failed|exception|crash|missing)/i)?.[1] || null;

  return {
    loader: "REDmod / RED4ext / CET",
    java: null,
    issue: error ? "Cyberpunk mod or framework issue" : null,
    error,
  };
}

  if (gameKey === "baldurs_gate_3") {
    const error =
      log.match(/(error|failed|exception|crash|missing)/i)?.[1] ||
      null;

    return {
      loader: "BG3 Mod Manager / Script Extender",
      java: null,
      issue: error ? "BG3 mod or Script Extender issue" : null,
      error,
    };
  }

    if (gameKey === "project_zomboid") {
  let issue: string | null = null;
  let error: string | null = null;

  if (lower.includes("stack traceback") || lower.includes("attempt to index a nil value")) {
  issue = "Lua error";
  error = "LuaError";
} else if (lower.includes("game crashed")) {
  issue = "Game crash detected";
  error = "Crash";
} else if (lower.includes("workshop item version mismatch")) {
  issue = "Workshop warning";
  error = "WorkshopWarning";
} else if (lower.includes("mod id:") && lower.includes("failed to load")) {
  issue = "Partially failed mod load";
  error = "PartialModLoad";
  } else {
    error =
      log.match(/(error|failed|exception|crash|traceback|missing)/i)?.[1] || null;
    issue = error ? "Project Zomboid mod or Lua issue" : null;
  }

  return {
    loader: "Zomboid / Lua / Workshop",
    java: null,
    issue,
    error,
  };
}

  const rawError =
  log.match(/([A-Za-z0-9_.]*(Exception|Error))(?::\s*[^\n]*)?/i)?.[1]?.trim() ||
  log.match(/(crash|error|failed)/i)?.[1] ||
  null;

const finalError =
  rawError?.toLowerCase() === "error" ? "UnknownError" : rawError;

return {
  loader: null,
  java: null,
  issue: finalError === "UnknownError" ? "Unknown issue" : finalError,
  error: finalError,
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

  if (gameKey === "stardew_valley") {
  for (const line of lines) {
    const skippedModMatch = line.match(/-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's/i);
    if (skippedModMatch?.[1]) {
      mods.add(skippedModMatch[1].trim().toLowerCase());
    }

    const fromModsMatch = line.match(/from Mods\\([^\\,\]]+)/i);
    if (fromModsMatch?.[1]) {
      mods.add(fromModsMatch[1].trim().toLowerCase());
    }

    const smapiNamedMatch = line.match(/\[INFO\s+SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\d/i);
    if (smapiNamedMatch?.[1]) {
      mods.add(smapiNamedMatch[1].trim().toLowerCase());
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

    if (gameKey === "cyberpunk2077") {
    for (const line of lines) {
      const matches = line.match(/\b(redscript|red4ext|cyber engine tweaks|archive xl|tweakxl|codeware|redmod)\b/gi);
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }

      const archiveMatch = line.match(/archive[\/\\]pc[\/\\]mod[\/\\]([a-z0-9._ -]+)/i);
      if (archiveMatch?.[1]) {
        mods.add(archiveMatch[1].trim().toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "baldurs_gate_3") {
    for (const line of lines) {
      const matches = line.match(/\b(script extender|bg3 mod manager|improvedui|mod fixer|lslib|gustav)\b/gi);
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }

      const pakMatch = line.match(/([a-z0-9._ -]+)\.pak/i);
      if (pakMatch?.[1]) {
        mods.add(pakMatch[1].trim().toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "project_zomboid") {
    for (const line of lines) {
      const matches = line.match(/\b(workshop|mod id|map folder|lua|b41|b42)\b/gi);
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }

      const modIdMatch = line.match(/mod id[:=]\s*([a-z0-9._-]+)/i);
      if (modIdMatch?.[1]) {
        mods.add(modIdMatch[1].toLowerCase());
      }

      const workshopMatch = line.match(/workshop item[:=]\s*([0-9]+)/i);
      if (workshopMatch?.[1]) {
        mods.add(`workshop-${workshopMatch[1]}`);
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
    lower.includes("archive\\pc\\mod") ||
    lower.includes("archive/pc/mod") ||
    lower.includes("red4ext") ||
    lower.includes("cyber engine tweaks")
  ) {
    return "cyberpunk2077";
  }

  if (
    lower.includes("baldur's gate 3") ||
    lower.includes("baldurs gate 3") ||
    lower.includes("bg3") ||
    lower.includes("larian") ||
    lower.includes("script extender") ||
    lower.includes("gustav") ||
    lower.includes("story compilation error")
  ) {
    return "baldurs_gate_3";
  }

    if (
    lower.includes("project zomboid") ||
    lower.includes("zomboid") ||
    lower.includes("pz.log") ||
    lower.includes("lua checksum") ||
    lower.includes("workshop item version") ||
    lower.includes("mods loaded") ||
    lower.includes("stack traceback") ||
    lower.includes("attempt to index a nil value") ||
    lower.includes("mod id:") ||
    lower.includes("failed to load")
  ) {
    return "project_zomboid";
  }

  return null;
}

function getMostSuspiciousLine(log: string, gameKey: string) {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  // Game-specific priority overrides FIRST
  if (gameKey === "baldurs_gate_3") {
    const dependencyLine = lines.find((line) =>
      line.toLowerCase().includes("missing dependency")
    );
    if (dependencyLine) return dependencyLine;

    const failedLoadingLine = lines.find((line) =>
      line.toLowerCase().includes("failed loading")
    );
    if (failedLoadingLine) return failedLoadingLine;

    const mismatchLine = lines.find((line) =>
      line.toLowerCase().includes("mismatch")
    );
    if (mismatchLine) return mismatchLine;
  }

  if (gameKey === "cyberpunk2077") {
    const dependencyLine = lines.find((line) =>
      line.toLowerCase().includes("missing dependency")
    );
    if (dependencyLine) return dependencyLine;

    const failedLine = lines.find((line) =>
      line.toLowerCase().includes("failed")
    );
    if (failedLine) return failedLine;

    const exceptionLine = lines.find((line) =>
      line.toLowerCase().includes("exception")
    );
    if (exceptionLine) return exceptionLine;
  }

  if (gameKey === "project_zomboid") {
    const tracebackLine = lines.find((line) =>
      line.toLowerCase().includes("traceback")
    );
    if (tracebackLine) return tracebackLine;

    const nilValueLine = lines.find((line) =>
      line.toLowerCase().includes("nil value")
    );
    if (nilValueLine) return nilValueLine;

    const failedModLine = lines.find((line) =>
      line.toLowerCase().includes("failed to load")
    );
    if (failedModLine) return failedModLine;
  }

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
    } else if (gameKey === "baldurs_gate_3") {
      if (lower.includes("missing dependency")) score += 20;
      if (lower.includes("failed loading")) score += 16;
      if (lower.includes("modsettings.lsx")) score += 15;
      if (lower.includes("script extender mismatch")) score += 14;
      if (lower.includes("story compilation error")) score += 13;
      if (lower.includes("script extender")) score += 8;
      if (lower.includes("improvedui")) score += 10;
      if (lower.includes("error")) score += 6;
      if (lower.includes("crashed")) score += 2;
    } else if (gameKey === "cyberpunk2077") {
      if (lower.includes("missing dependency")) score += 20;
      if (lower.includes("codeware")) score += 14;
      if (lower.includes("archivexl")) score += 14;
      if (lower.includes("red4ext")) score += 12;
      if (lower.includes("cyber_engine_tweaks")) score += 12;
      if (lower.includes("failed")) score += 10;
      if (lower.includes("exception")) score += 9;
      if (lower.includes("access violation")) score += 8;
      if (lower.includes("error")) score += 6;
      if (lower.includes("crashed")) score += 2;
    } else if (gameKey === "project_zomboid") {
      if (lower.includes("traceback")) score += 18;
      if (lower.includes("nil value")) score += 16;
      if (lower.includes("failed to load")) score += 14;
      if (lower.includes("workshop item version mismatch")) score += 12;
      if (lower.includes("mod id:")) score += 10;
      if (lower.includes("exception")) score += 8;
      if (lower.includes("error")) score += 7;
      if (lower.includes("crashed")) score += 2;
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
      `FixMyGame Pro can automatically find likely ${gameLabel} logs, load the best one, and make troubleshooting much faster.`,
    features: [
      "Unlimited diagnostics",
      `Automatic ${gameLabel} log discovery`,
      "Full-folder scanning",
      "Saved analysis exports",
      "Faster troubleshooting workflow",
      "Smarter file discovery",
      "Future multi-game support",
    ],
  };

    case "folderScan":
    return {
    eyebrow: "FIXMYGAME PRO",
    title: "Upgrade to unlock full-folder scanning",
    description:
      `FixMyGame Pro can scan an entire folder, find likely ${gameLabel} logs, and load the best one automatically.`,
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
      `FixMyGame Pro lets you save your ${gameLabel} results to a file so you can keep them, share them, or compare them later.`,
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
    title: "Upgrade to unlock the full FixMyGame workflow",
    description:
      `FixMyGame Pro gives you a faster, more complete way to diagnose ${gameLabel} crashes without manual digging.`,
    features: [
      "Unlimited diagnostics",
      `Automatic ${gameLabel} log discovery`,
      "Full-folder scanning",
      "Saved analysis exports",
      "Faster troubleshooting workflow",
    ],
  };
  }
}

const GAME_PRESETS = [
  { key: "minecraft", label: "Minecraft" },
  { key: "sims4", label: "The Sims 4" },
  { key: "skyrimse", label: "Skyrim Special Edition" },
  { key: "gmod", label: "Garry's Mod" },
  { key: "fallout4", label: "Fallout 4" },
  { key: "fallout_new_vegas", label: "Fallout: New Vegas" },
  { key: "cyberpunk2077", label: "Cyberpunk 2077" },
  { key: "starfield", label: "Starfield" },
  { key: "cities_skylines", label: "Cities: Skylines" },
  { key: "stardew_valley", label: "Stardew Valley" },
  { key: "slime_rancher", label: "Slime Rancher" },
  { key: "slime_rancher_2", label: "Slime Rancher 2" },
  { key: "rimworld", label: "RimWorld" },
  { key: "project_zomboid", label: "Project Zomboid" },
  { key: "terraria", label: "Terraria" },
  { key: "kerbal_space_program", label: "Kerbal Space Program" },
  { key: "bannerlord", label: "Bannerlord (Mount & Blade II)" },
  { key: "baldurs_gate_3", label: "Baldur's Gate 3" },
  { key: "witcher3", label: "The Witcher 3" },
  { key: "seven_days_to_die", label: "7 Days to Die" },
  { key: "xcom2", label: "XCOM 2" },
  { key: "valheim", label: "Valheim" },
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
    label: "Minecraft",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  sims4: {
    label: "The Sims 4",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  skyrimse: {
    label: "Skyrim Special Edition",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  gmod: {
    label: "Garry's Mod",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  fallout4: {
    label: "Fallout 4",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
    fallout_new_vegas: {
    label: "Fallout: New Vegas",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  cyberpunk2077: {
    label: "Cyberpunk 2077",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  starfield: {
    label: "Starfield",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  cities_skylines: {
    label: "Cities: Skylines",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  stardew_valley: {
    label: "Stardew Valley",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
    slime_rancher: {
    label: "Slime Rancher",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  slime_rancher_2: {
    label: "Slime Rancher 2",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  rimworld: {
    label: "RimWorld",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  project_zomboid: {
    label: "Project Zomboid",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  terraria: {
    label: "Terraria",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  kerbal_space_program: {
    label: "Kerbal Space Program",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  bannerlord: {
    label: "Bannerlord (Mount & Blade II)",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
    baldurs_gate_3: {
    label: "Baldur's Gate 3",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  witcher3: {
    label: "The Witcher 3",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  seven_days_to_die: {
    label: "7 Days to Die",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  xcom2: {
    label: "XCOM 2",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  valheim: {
    label: "Valheim",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  resident_evil_re: {
    label: "Resident Evil (RE Engine)",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  lethal_company: {
    label: "Lethal Company",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  palworld: {
    label: "Palworld",
    supportsAutoDetect: true,
    supportsModsFolder: true,
    supportsLogsFolder: true,
  },
  custom: {
    label: "Custom / Other",
    supportsAutoDetect: true,
    supportsModsFolder: false,
    supportsLogsFolder: false,
  },
};

const API_BASE_URL = "https://fixmygame.vercel.app";

  const SORTED_GAME_PRESETS = [
  ...GAME_PRESETS.filter((g) => g.key !== "custom").sort((a, b) =>
    a.label.localeCompare(b.label)
  ),
  ...GAME_PRESETS.filter((g) => g.key === "custom"),
];

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

function getProgressState(params: {
  loadingDesktopLog: boolean;
  scanningLogs: boolean;
  running: boolean;
  applyingSafeFix: boolean;
  undoingSafeFix: boolean;
  runningFixPlan: boolean;
}) {
  if (params.loadingDesktopLog) {
    return {
      title: "Loading crash log",
      description: "FixMyGame is reading your selected log file.",
      steps: ["Choose file", "Read log", "Update screen"],
      activeStep: 1,
    };
  }

  if (params.scanningLogs) {
    return {
      title: "Scanning for logs",
      description: "FixMyGame is searching for likely crash and log files.",
      steps: ["Search folders", "Find likely logs", "Load best match"],
      activeStep: 1,
    };
  }

  if (params.running) {
    return {
      title: "Running diagnostic",
      description: "FixMyGame is analyzing your crash log and building a repair plan.",
      steps: ["Read crash", "Detect issues", "Build results"],
      activeStep: 1,
    };
  }

  if (params.applyingSafeFix) {
    return {
      title: "Applying safe fix",
      description: "FixMyGame is making a safe change and creating a backup.",
      steps: ["Review match", "Create backup", "Move file", "Save results"],
      activeStep: 2,
    };
  }

  if (params.undoingSafeFix) {
    return {
      title: "Undoing last fix",
      description: "FixMyGame is restoring the last changed file.",
      steps: ["Find backup", "Restore file", "Update results"],
      activeStep: 1,
    };
  }

  if (params.runningFixPlan) {
    return {
      title: "Opening tools and copying steps",
      description: "FixMyGame is guiding you through the repair.",
      steps: ["Open mods folder", "Open logs folder", "Copy fix steps"],
      activeStep: 1,
    };
  }

  return null;
}

export default function Page() {
  const [betaOpen, setBetaOpen] = useState(false);
  const [missingModRecovery, setMissingModRecovery] =
  useState<MissingModRecoveryResult | null>(null);
  const [searchingMissingMod, setSearchingMissingMod] = useState(false);
  const [movingMissingMod, setMovingMissingMod] = useState(false);
  const [betaMessage, setBetaMessage] = useState("");
  const [checkingBetaStatus, setCheckingBetaStatus] = useState(true);
  const [showError, setShowError] = useState(false);
  const [selectedGameKey, setSelectedGameKey] = useState("minecraft");
  const [hasAppliedAutoGameDetect, setHasAppliedAutoGameDetect] = useState(false);
  const [hasAcceptedAuthorization, setHasAcceptedAuthorization] = useState(false);
  const [checkingAuthorization, setCheckingAuthorization] = useState(true);
  const [supportTelemetryEnabled, setSupportTelemetryEnabled] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"privacy" | "app">("privacy");
  const [appSettings, setAppSettings] =
  useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [supportSessionId] = useState(() => crypto.randomUUID());
  const [supportEventHistory, setSupportEventHistory] = useState<
  {
    id: string;
    type: string;
    createdAt: string;
    detail?: string;
  }[]
>([]);
  const [gpuModel, setGpuModel] = useState("RTX 3060");
  const [driverVersion, setDriverVersion] = useState("551.86");
  const [graphicsApiMode, setGraphicsApiMode] = useState("Auto Detect");
  const [crashLog, setCrashLog] = useState("");
  const [currentLogPath, setCurrentLogPath] = useState("");
  const [gameInstallDetected, setGameInstallDetected] = useState<boolean | null>(null);
  const [gameInstallPath, setGameInstallPath] = useState("");
  const [checkingInstall, setCheckingInstall] = useState(false);
  
  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState(3);
  const [remaining, setRemaining] = useState(3);
  const [isBetaAccess, setIsBetaAccess] = useState(false);

  const [autoDetectStatus, setAutoDetectStatus] = useState<
  "idle" | "logs_found" | "no_logs" | "not_installed"
>("idle");
  const [loadingLimit, setLoadingLimit] = useState(true);
  const [running, setRunning] = useState(false);
  const [progressTick, setProgressTick] = useState(0);
  const [loadingDesktopLog, setLoadingDesktopLog] = useState(false);
  const [scanningLogs, setScanningLogs] = useState(false);
  const [detectingSystemSpecs, setDetectingSystemSpecs] = useState(false);
  const [result, setResult] = useState<string>("");
  const [hasRunDiagnosticThisSession, setHasRunDiagnosticThisSession] = useState(false);
  const [shouldAutoScrollToResult, setShouldAutoScrollToResult] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [folderActionError, setFolderActionError] = useState("");
  const [quickActionFolderError, setQuickActionFolderError] = useState("");
  function setTimedError(
  setter: (value: string) => void,
  message: string,
  duration = 4000
) {
  setter(message);
  setTimeout(() => {
    setter("");
  }, duration);
}
  const [actionMsg, setActionMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showFixGuide, setShowFixGuide] = useState(false);
  const [currentGuideStep, setCurrentGuideStep] = useState(0);
  const [completedGuideSteps, setCompletedGuideSteps] = useState<number[]>([]);
  const [showFixPreviewModal, setShowFixPreviewModal] = useState(false);
  const [showFixHistoryModal, setShowFixHistoryModal] = useState(false);
  const [fixPreviewError, setFixPreviewError] = useState("");
  const [fixHistoryTab, setFixHistoryTab] = useState<"saved" | "diagnostics">("saved");
  const [actionMsgLocation, setActionMsgLocation] = useState<"fixAssistant" | "smartFix" | "diagnostic" | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [applyingSafeFix, setApplyingSafeFix] = useState(false);
  const [undoingSafeFix, setUndoingSafeFix] = useState(false);
  const [proModalContext, setProModalContext] = useState<"autoDetect" | "folderScan" | "saveAnalysis">("autoDetect");
  const [detectedLogs, setDetectedLogs] = useState<
  { name: string; fullPath: string; lastModified?: number; size?: number }[]
>([]);
  const [hasScannedLogs, setHasScannedLogs] = useState(false);
  const [detectedSignals, setDetectedSignals] = useState<AnalyzeResponse["detectedSignals"] | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse["analysis"] | null>(null);
  const [quickSignals, setQuickSignals] = useState<{
    status?: string | null;
    session?: string | null;
    loader?: string | null;
    java?: string | null;
    issue?: string | null;
    error?: string | null;
  }>({});
  const [debugVid, setDebugVid] = useState("");
  const [debugProStatus, setDebugProStatus] = useState("");
  const [fixExecutionResults, setFixExecutionResults] = useState<FixExecutionResult[]>([]);
  const [runningFixPlan, setRunningFixPlan] = useState(false);
  const [fixHistoryItems, setFixHistoryItems] = useState<FixHistoryItem[]>([]);
  const [logHighlights, setLogHighlights] = useState<string[]>([]);
  const [liveMods, setLiveMods] = useState<string[]>([]);
  const [mostSuspiciousLine, setMostSuspiciousLine] = useState<string | null>(null);
  const [showFixFeedback, setShowFixFeedback] = useState(false);
  const [continuedDiagnosticBase, setContinuedDiagnosticBase] =
  useState<FixHistoryItem | null>(null);
  const [resultFollowupMessage, setResultFollowupMessage] = useState("");
  const [resultFollowupTone, setResultFollowupTone] = useState<"success" | "info" | "warning" | null>(null);
  const [showDiagnosticRefineBox, setShowDiagnosticRefineBox] = useState(false);
  const [diagnosticRefineMode, setDiagnosticRefineMode] = useState<"continue" | "still_crashing" | null>(null);
  const [diagnosticRefineText, setDiagnosticRefineText] = useState("");
  const [showAdditionalRefineLogBox, setShowAdditionalRefineLogBox] = useState(false);
  const [additionalRefineLog, setAdditionalRefineLog] = useState("");
  const [lastFixResult, setLastFixResult] = useState<{
  movedFile?: string;
  matchedName?: string;
  matchedSuspect?: string;
  itemType?: "file" | "folder";
  candidateKind?: "empty_folder" | "invalid_loose_file" | "mod_file" | "mod_folder";
  backupPath?: string;
  quarantinePath?: string;
  originalPath?: string;
  mods?: string[];
} | null>(null);
const diagnosticResultRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
  fetchBetaStatus();
}, []);

  useEffect(() => {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw) as Partial<AppSettings>;

    setAppSettings({
      ...DEFAULT_APP_SETTINGS,
      ...saved,
    });
  } catch {
    setAppSettings(DEFAULT_APP_SETTINGS);
  }
}, []);
useEffect(() => {
  try {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify(appSettings)
    );
  } catch {
    // ignore storage errors
  }
}, [appSettings]);

  useEffect(() => {
  try {
    const raw = localStorage.getItem(SYSTEM_PREFS_STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);

    if (typeof saved.selectedGameKey === "string" && saved.selectedGameKey) {
      setSelectedGameKey(saved.selectedGameKey);
    }

    if (typeof saved.gpuModel === "string") {
      setGpuModel(saved.gpuModel);
    }

    if (typeof saved.driverVersion === "string") {
      setDriverVersion(saved.driverVersion);
    }

    if (typeof saved.graphicsApiMode === "string") {
      setGraphicsApiMode(saved.graphicsApiMode);
    }
  } catch {
    // ignore bad saved data
  }
}, []);

useEffect(() => {
  try {
    localStorage.setItem(
      SYSTEM_PREFS_STORAGE_KEY,
      JSON.stringify({
        selectedGameKey,
        gpuModel,
        driverVersion,
        graphicsApiMode,
      })
    );
  } catch {
    // ignore storage errors
  }
}, [selectedGameKey, gpuModel, driverVersion, graphicsApiMode]);

  const canRun = useMemo(
  () => isPro || isBetaAccess || remaining > 0,
  [isPro, isBetaAccess, remaining]
);
  const progressState = useMemo(
  () =>
    getProgressState({
      loadingDesktopLog,
      scanningLogs,
      running,
      applyingSafeFix,
      undoingSafeFix,
      runningFixPlan,
    }),
  [
    loadingDesktopLog,
    scanningLogs,
    running,
    applyingSafeFix,
    undoingSafeFix,
    runningFixPlan,
  ]
);

const progressPercent = progressState
  ? Math.min(95, 15 + progressTick * 8)
  : 0;

useEffect(() => {
  const isProgressActive =
    loadingDesktopLog ||
    scanningLogs ||
    running ||
    applyingSafeFix ||
    undoingSafeFix ||
    runningFixPlan;

  if (!isProgressActive) {
    setProgressTick(0);
    return;
  }

  const interval = window.setInterval(() => {
    setProgressTick((tick) => tick + 1);
  }, 700);

  return () => window.clearInterval(interval);
}, [
  loadingDesktopLog,
  scanningLogs,
  running,
  applyingSafeFix,
  undoingSafeFix,
  runningFixPlan,
]);

const selectedGame = useMemo(
  () => GAME_PRESETS.find((g) => g.key === selectedGameKey) ?? SORTED_GAME_PRESETS[0],
  [selectedGameKey]
);

const gameTitle = selectedGame.label;

const smartFixResultOverride = useMemo(
  () =>
    buildSmartFixResultOverride({
      gameKey: selectedGameKey,
      crashLog,
      analysis,
      detectedSignals,
    }),
  [selectedGameKey, crashLog, analysis, detectedSignals]
);

const universalFallbackOverride = useMemo(
  () =>
    buildUniversalFallbackOverride({
      gameTitle,
      crashLog,
      analysis: smartFixResultOverride ?? analysis,
      detectedSignals,
    }),
  [gameTitle, crashLog, analysis, detectedSignals, smartFixResultOverride]
);

const displayAnalysis =
  universalFallbackOverride ??
  smartFixResultOverride ??
  analysis;

const displayDetectedSignals =
  displayAnalysis?.detectedSignals ||
  detectedSignals;

  const smartFixPath = useMemo(
  () =>
    getSmartFixPath(
      displayDetectedSignals,
      displayAnalysis,
      selectedGameKey,
      currentLogPath,
      crashLog
    ),
  [
    displayDetectedSignals,
    displayAnalysis,
    selectedGameKey,
    currentLogPath,
    crashLog,
  ]
);

const loadedLogSummary = useMemo(
  () =>
    buildLoadedLogSummary({
      crashLog,
    }),
  [gameTitle, crashLog]
);

useEffect(() => {
  if (!shouldAutoScrollToResult || !displayAnalysis || !result || running) return;

  const timer = window.setTimeout(() => {
    diagnosticResultRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setShouldAutoScrollToResult(false);
  }, 250);

  return () => window.clearTimeout(timer);
}, [shouldAutoScrollToResult, displayAnalysis, result, running]);

function resetLiveSessionState() {
  setCrashLog("");
  setCurrentLogPath("");
  setDetectedLogs([]);
  setHasScannedLogs(false);
  setAutoDetectStatus("idle");

  setResult("");
  setHasRunDiagnosticThisSession(false);
  setShouldAutoScrollToResult(false);
  setAnalysis(null);
  setDetectedSignals(null);

  setQuickSignals({});
  setLogHighlights([]);
  setLiveMods([]);
  setMostSuspiciousLine(null);

  setErrorMsg("");
  setFolderActionError("");
  setQuickActionFolderError("");
  setActionMsg("");
  setActionMsgLocation(null);

  setFixExecutionResults([]);
  setLastFixResult(null);
  setShowFixFeedback(false);

  setContinuedDiagnosticBase(null);
  setResultFollowupMessage("");
  setResultFollowupTone(null);
  setShowDiagnosticRefineBox(false);
  setDiagnosticRefineMode(null);
  setDiagnosticRefineText("");
  setShowAdditionalRefineLogBox(false);
  setAdditionalRefineLog("");

  setShowFixGuide(false);
  setShowFixPreviewModal(false);
}

function getKnownMissingModDownloadUrl(modName: string) {
  const normalized = String(modName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (
  normalized.includes("fabric api") ||
  normalized.includes("fabricapi")
) {
  return "https://modrinth.com/mod/fabric-api";
}

  if (normalized.includes("content patcher")) {
    return "https://www.nexusmods.com/stardewvalley/mods/1915";
  }

  if (normalized.includes("smapi")) {
    return "https://smapi.io/";
  }

  return "";
}

function getPrimaryMissingModName() {
  const steps = displayAnalysis?.recommendedFixSteps || [];
  const rawText = [
    displayAnalysis?.quickFixFirst || "",
    displayAnalysis?.issue || "",
    displayAnalysis?.mostLikelyCause || "",
    ...steps,
    crashLog || "",
  ].join("\n");

  const contentPatcherMatch = rawText.match(/content patcher/i);
  if (contentPatcherMatch) return "Content Patcher";

  const fabricApiMatch = rawText.match(/\bfabric[-\s]?api\b/i);
if (fabricApiMatch) return "Fabric API";

  const genericMatch =
    rawText.match(/missing mod called ([A-Za-z0-9 '\-\[\]\(\)&._]+)/i) ||
    rawText.match(/requires mods? which aren't installed \(([^:]+):/i) ||
    rawText.match(/install the missing ([A-Za-z0-9 '\-\[\]\(\)&._]+) mod/i);

  return genericMatch?.[1]?.trim() || "";
}

function getMissingModDownloadUrl() {
  const knownUrl = getKnownMissingModDownloadUrl(primaryMissingModName);
  if (knownUrl) return knownUrl;

  const combined = [
    ...(displayAnalysis?.recommendedFixSteps || []),
    displayAnalysis?.issue || "",
    displayAnalysis?.mostLikelyCause || "",
    crashLog || "",
  ].join("\n");

  const match = combined.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] || "";
}

async function searchForMissingModOnDevice() {
  const modName = missingModRecoveryTarget;
  if (!modName) {
    setErrorMsg("No missing mod name could be identified from this diagnosis.");
    return;
  }

  if (!window.fixMyGame?.findMissingModOnDevice) {
    setErrorMsg("Missing-mod recovery is only available in the desktop app.");
    return;
  }

  try {
    setSearchingMissingMod(true);
    setErrorMsg("");
    setMissingModRecovery(null);

    const result = await window.fixMyGame.findMissingModOnDevice({
      gameKey: selectedGameKey,
      modName,
    });

    setMissingModRecovery(result);

    if (result.found) {
      showActionMessage(
        result.alreadyInCorrectPlace
          ? `${modName} is already in the correct Mods folder.`
          : `${modName} was found on this device.`,
        "fixAssistant"
      );
    } else {
      showActionMessage(
        `${modName} was not found in the common local mod locations we searched.`,
        "fixAssistant"
      );
    }
  } catch (error) {
    setErrorMsg(
      error instanceof Error ? error.message : "Failed to search for the missing mod."
    );
  } finally {
    setSearchingMissingMod(false);
  }
}

async function moveFoundModIntoModsFolder() {
  const modName = missingModRecoveryTarget;
  if (!modName) {
    setErrorMsg("No missing mod name could be identified from this diagnosis.");
    return;
  }

  if (!missingModRecovery?.foundPath) {
    setErrorMsg("No found mod location is available to move.");
    return;
  }

  if (!window.fixMyGame?.moveFoundModToModsFolder) {
    setErrorMsg("Moving mods is only available in the desktop app.");
    return;
  }

  try {
    setMovingMissingMod(true);
    setErrorMsg("");

    const result = await window.fixMyGame.moveFoundModToModsFolder({
      gameKey: selectedGameKey,
      modName,
      sourcePath: missingModRecovery.foundPath,
    });

    setMissingModRecovery((prev) =>
  prev
    ? {
        ...prev,
        found: true,
        foundPath: result.destinationPath,
        expectedPath: result.destinationPath,
        alreadyInCorrectPlace: false,
        justMovedToCorrectPlace: !result.alreadyInCorrectPlace,
      }
    : prev
);

    showActionMessage(
  result.alreadyInCorrectPlace
    ? `${modName} is already in the correct Mods folder.`
    : `${modName} was successfully moved into the Mods folder.`,
  "fixAssistant"
);
  } catch (error) {
    setErrorMsg(
      error instanceof Error ? error.message : "Failed to move the missing mod."
    );
  } finally {
    setMovingMissingMod(false);
  }
}

async function openMissingModDownloadPage() {
  const url = getMissingModDownloadUrl();
  if (!url) {
    setErrorMsg("No download page was found in the diagnosis or log.");
    return;
  }

  if (!window.fixMyGame?.openExternalUrl) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    await window.fixMyGame.openExternalUrl(url);
    showActionMessage("Opened the missing mod download page.", "fixAssistant");
  } catch (error) {
    setErrorMsg(
      error instanceof Error ? error.message : "Failed to open the download page."
    );
  }
}

function toggleSupportTelemetry() {
  const next = !supportTelemetryEnabled;
  setSupportTelemetryEnabled(next);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      SUPPORT_TELEMETRY_STORAGE_KEY,
      next ? "true" : "false"
    );
  }
}

function applyDetectedGameOnce(detectedGame: string | null) {
  if (!detectedGame) return;

  if (!hasAppliedAutoGameDetect && detectedGame !== selectedGameKey) {
    setSelectedGameKey(detectedGame);
    setHasAppliedAutoGameDetect(true);

    showActionMessage(
      `Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`,
      "fixAssistant"
    );
  }
}

  const proModalContent = useMemo(
  () => getProModalContent(proModalContext, gameTitle),
  [proModalContext, gameTitle]
);

function showActionMessage(
  message: string,
  location: "fixAssistant" | "smartFix" | "diagnostic"
) {
  setActionMsg(message);
  setActionMsgLocation(location);

  const duration =
    location === "fixAssistant" && message.startsWith("Loaded latest log")
      ? 8000
      : 5000;

  setTimeout(() => {
    setActionMsg("");
    setActionMsgLocation(null);
  }, duration);
}

function openSupportEmail() {
  const subject = encodeURIComponent(
    `FixMyGame Issue Report — ${gameTitle || "Unknown Game"}`
  );

  const body = encodeURIComponent(`
Describe your issue here:

What happened:
What did you expect:
Steps to reproduce:
Did the game crash or did FixMyGame behave incorrectly:


(Please leave the technical details below — they help us fix your issue faster.)
---

App Version: 1.0.0
Game: ${gameTitle || "Not selected"}
GPU: ${gpuModel || "Not provided"}
Driver: ${driverVersion || "Not provided"}
Graphics API: ${graphicsApiMode || "Not provided"}

---

Continuation Mode: ${
    continuedDiagnosticBase ? "Active" : "Not Active"
  }

---

Last Diagnostic Result:
${result ? result.slice(0, 1500) : "No diagnostic result available"}

---

Detected Signals:
${
  displayAnalysis?.detectedSignals
    ? JSON.stringify(displayAnalysis.detectedSignals, null, 2).slice(0, 800)
    : displayDetectedSignals
    ? JSON.stringify(displayDetectedSignals, null, 2).slice(0, 800)
    : "None"
}

---

(Optional) Crash Log Snippet:
${crashLog ? crashLog.slice(0, 1500) : "Not provided"}
`);

  window.location.href = `mailto:fixmygame.support@gmail.com?subject=${subject}&body=${body}`;
}

async function runRefinedDiagnosticNow() {
  const nextLog = additionalRefineLog.trim() || crashLog.trim();

  if (!nextLog) {
    setErrorMsg("Paste a crash log / error first, or add an additional crash log below.");
    return;
  }

  await runDiagnostic(nextLog);
}

function startResultRefinement(mode: "continue" | "still_crashing") {
  if (!displayAnalysis) return;

  const diagnosticText = buildDiagnosticResultText(displayAnalysis, result);

  const tempBase: FixHistoryItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    gameKey: selectedGameKey,
    gameTitle,
    type: "diagnostic_run",
    title: `${gameTitle} continued diagnostic base`,
    text: diagnosticText,
    analysisSummary: {
      issue: displayAnalysis?.issue,
quickFixFirst: displayAnalysis?.quickFixFirst,
mostLikelyCause: displayAnalysis?.mostLikelyCause,
needMoreInfo: displayAnalysis?.needMoreInfo,
likelyCategory:
  displayAnalysis?.detectedSignals?.likelyCategory ||
  displayDetectedSignals?.likelyCategory,
suspectedMods:
  displayAnalysis?.detectedSignals?.suspectedMods ||
  displayDetectedSignals?.suspectedMods ||
  [],
      previousRelevantLog: crashLog,
    },
  };

  setContinuedDiagnosticBase(tempBase);
  setDiagnosticRefineMode(mode);
  setShowDiagnosticRefineBox(true);
  setDiagnosticRefineText("");
  resetResultFollowupMessage();
}

function showResultFollowupMessage(
  message: string,
  tone: "success" | "info" | "warning"
) {
  setResultFollowupMessage(message);
  setResultFollowupTone(tone);
}

function resetResultFollowupMessage() {
  setResultFollowupMessage("");
  setResultFollowupTone(null);
}

function undoResultRefinement() {
  setShowDiagnosticRefineBox(false);
  setDiagnosticRefineMode(null);
  setDiagnosticRefineText("");
  setShowAdditionalRefineLogBox(false);
  setAdditionalRefineLog("");
  setContinuedDiagnosticBase(null);
  resetResultFollowupMessage();
}

function acceptAuthorizationGate() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_AUTH_STORAGE_KEY, "true");
    window.localStorage.setItem(
      SUPPORT_TELEMETRY_STORAGE_KEY,
      supportTelemetryEnabled ? "true" : "false"
    );
  }

  setHasAcceptedAuthorization(true);
}

async function fetchBetaStatus() {
  try {
    const data = await fetchJSON<{ betaOpen: boolean; message?: string }>(
      `${API_BASE_URL}/api/beta-status?t=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    setBetaOpen(Boolean(data.betaOpen));
    setBetaMessage(
      data.message ||
        (data.betaOpen
          ? "FixMyGame beta is active."
          : "The FixMyGame beta period has ended.")
    );
  } catch (error) {
  setBetaOpen(false);
  setBetaMessage(
    error instanceof Error
      ? `FixMyGame could not verify beta access: ${error.message}`
      : "FixMyGame could not verify beta access right now."
  );
}finally {
    setCheckingBetaStatus(false);
  }
}

async function exitAuthorizationGate() {
  if (window.fixMyGame?.closeApp) {
    await window.fixMyGame.closeApp();
    return;
  }

  window.close();
}

async function autoFillSystemSpecs() {
  setErrorMsg("");

  if (!window.fixMyGame?.detectSystemSpecs) {
    setErrorMsg("Auto-fill system info is only available inside the Electron desktop app.");
    return;
  }

  try {
    setDetectingSystemSpecs(true);

    const response = await window.fixMyGame.detectSystemSpecs();

    if (!response?.ok) {
      setErrorMsg(response?.error || "Could not auto-fill system info.");
      return;
    }

    if (response.gpuModel) {
      setGpuModel(response.gpuModel);
    }

    if (response.driverVersion) {
      setDriverVersion(response.driverVersion);
    }

    setGraphicsApiMode(response.graphicsApiMode || "Auto Detect");

    showActionMessage("System info detected and fields updated.", "diagnostic");
  } catch (error) {
    setErrorMsg(
      error instanceof Error ? error.message : "Could not auto-fill system info."
    );
  } finally {
    setDetectingSystemSpecs(false);
  }
}

async function copyTextReliable(text: string) {
  const safeText = String(text ?? "");

  if (window.fixMyGame?.copyText) {
    const response = await window.fixMyGame.copyText(safeText);
    if (response?.ok) {
      return;
    }
  }

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(safeText);
      return;
    }
  } catch {
    // fall through to execCommand fallback
  }

  const textArea = document.createElement("textarea");
  textArea.value = safeText;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let success = false;

  try {
    success = document.execCommand("copy");
  } catch {
    success = false;
  }

  document.body.removeChild(textArea);

  if (!success) {
    throw new Error("Clipboard copy failed.");
  }
}

function addToFixHistory(
  type: FixHistoryItem["type"],
  title: string,
  text: string,
  analysisSummary?: FixHistoryItem["analysisSummary"]
) {
  const item: FixHistoryItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    gameKey: selectedGameKey,
    gameTitle,
    type,
    title,
    text,
    analysisSummary,
  };

  const next = pushFixHistoryItem(item);
  setFixHistoryItems(next);
}

const savedHistoryItems = useMemo(
  () => fixHistoryItems.filter((item) => item.type !== "diagnostic_run"),
  [fixHistoryItems]
);

const diagnosticHistoryItems = useMemo(
  () => fixHistoryItems.filter((item) => item.type === "diagnostic_run"),
  [fixHistoryItems]
);

const visibleHistoryItems =
  fixHistoryTab === "saved" ? savedHistoryItems : diagnosticHistoryItems;

const selectedGameProfile = useMemo(
  () => GAME_PROFILES[selectedGameKey] ?? GAME_PROFILES.minecraft,
  [selectedGameKey]
);

const topFeaturePills = useMemo(
  () => getTopFeaturePills(selectedGameKey),
  [selectedGameKey]
);

const fixPlan = useMemo(
  () =>
    getFixPlan(
      selectedGameKey,
      gameTitle,
      displayAnalysis,
      displayDetectedSignals,
      selectedGameProfile
    ),
  [selectedGameKey, gameTitle, displayAnalysis, displayDetectedSignals, selectedGameProfile]
);

const activeSafeFixCategory =
  displayAnalysis?.detectedSignals?.likelyCategory ||
  displayDetectedSignals?.likelyCategory ||
  "";

  const isGameFilesCorrupt =
  activeSafeFixCategory === "game_files_corrupt";

const isMissingDependency =
  activeSafeFixCategory === "missing_dependency";

const isModConflict =
  activeSafeFixCategory === "mod_conflict";

const safeFixSuspects = useMemo(() => {
  const suspectsFromAnalysis =
    displayAnalysis?.detectedSignals?.suspectedMods ||
    displayDetectedSignals?.suspectedMods ||
    [];

  const normalized = [...suspectsFromAnalysis, ...liveMods]
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, 6);
}, [displayAnalysis, displayDetectedSignals, liveMods]);

const canApplySafeFix =
  appSettings.enableSafeFix &&
  desktopConnected &&
  Boolean(gameInstallPath) &&
  safeFixSuspects.length > 0 &&
  activeSafeFixCategory === "mod_conflict";

const hasDiagnosticResult = Boolean(
  hasRunDiagnosticThisSession && displayAnalysis && result
);
const canUndoLastFix = hasDiagnosticResult && Boolean(lastFixResult?.movedFile);

const primaryMissingModName = getPrimaryMissingModName();
const missingModDownloadUrl = getMissingModDownloadUrl();
const missingModAlreadyInstalled =
  Boolean(missingModRecovery?.found && missingModRecovery.alreadyInCorrectPlace);

const missingModRecoveryTarget = useMemo(() => {
  if (!displayAnalysis) return "";

  const lowerIssue = (displayAnalysis.issue || "").toLowerCase();
  const lowerCause = (displayAnalysis.mostLikelyCause || "").toLowerCase();
  const lowerQuickFix = (displayAnalysis.quickFixFirst || "").toLowerCase();
  const lowerSteps = (displayAnalysis.recommendedFixSteps || []).join(" ").toLowerCase();

  const category = displayAnalysis.detectedSignals?.likelyCategory || "";

  const stronglyMissingDependency =
    category === "missing_dependency" &&
    (
      lowerIssue.includes("missing mod") ||
      lowerIssue.includes("missing dependency") ||
      lowerCause.includes("missing mod") ||
      lowerCause.includes("missing dependency") ||
      lowerQuickFix.includes("install") ||
      lowerQuickFix.includes("missing") ||
      lowerSteps.includes("install the missing") ||
      lowerSteps.includes("requires mods which aren't installed") ||
      lowerSteps.includes("missing dependency")
    );

  if (!stronglyMissingDependency) return "";

  return primaryMissingModName || "";
}, [displayAnalysis, primaryMissingModName]);

const shouldShowMissingModRecovery =
  Boolean(missingModRecoveryTarget) &&
  displayAnalysis?.detectedSignals?.likelyCategory !== "game_files_corrupt";

useEffect(() => {
  if (!shouldShowMissingModRecovery) {
    setMissingModRecovery(null);
    return;
  }

  if (!missingModRecoveryTarget) return;
  if (!window.fixMyGame?.findMissingModOnDevice) return;

  let cancelled = false;

  async function autoSearchMissingMod() {
      try {
        if (!window.fixMyGame?.findMissingModOnDevice) {
          return;
        }
  
        const result = await window.fixMyGame.findMissingModOnDevice({
          gameKey: selectedGameKey,
          modName: missingModRecoveryTarget,
        });
  
        if (!cancelled) {
          setMissingModRecovery(result);
        }
      } catch {
        if (!cancelled) {
          setMissingModRecovery(null);
        }
      }
    }

  autoSearchMissingMod();

  return () => {
    cancelled = true;
  };
}, [shouldShowMissingModRecovery, missingModRecoveryTarget, selectedGameKey]);

useEffect(() => {
if (typeof window !== "undefined") {
  resetLiveSessionState();

  setCopied(false);
  setSaved(false);

  const savedAuthorization = window.localStorage.getItem(APP_AUTH_STORAGE_KEY);
  setHasAcceptedAuthorization(savedAuthorization === "true");
  setCheckingAuthorization(false);

  const savedSupportTelemetry = window.localStorage.getItem(
  SUPPORT_TELEMETRY_STORAGE_KEY
);
setSupportTelemetryEnabled(savedSupportTelemetry === "true");

  let vid = window.localStorage.getItem("fmg_vid");

  if (!vid) {
    vid = crypto.randomUUID();
    window.localStorage.setItem("fmg_vid", vid);
  }

  document.cookie = `vid=${vid}; path=/; max-age=31536000; SameSite=Lax`;
  setDebugVid(vid);
  setFixHistoryItems(loadFixHistory());
}
  let cancelled = false;

  async function loadLimit() {
    setLoadingLimit(true);
    try {
    const data = await fetchJSON<LimitResponse>(
  `${API_BASE_URL}/api/limit?t=${Date.now()}`,
  {
    method: "GET",
    cache: "no-store",
  }
);

setDebugProStatus("debug skipped during beta");
      if (cancelled) return;

      setIsPro(Boolean(data.isPro));
      setIsBetaAccess(Boolean(data.isBeta));
      setLimit(Number.isFinite(data.limit) ? data.limit : 3);
      setRemaining(Number.isFinite(data.remaining) ? data.remaining : 3);
    } catch {
      if (cancelled) return;
      setIsPro(false);
      setIsBetaAccess(false);
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

const detectSelectedGameInstall = React.useCallback(async (gameKey = selectedGameKey) => {
  if (!window.fixMyGame?.detectGameInstall) {
    setGameInstallDetected(null);
    setGameInstallPath("");
    return;
  }

  try {
    setCheckingInstall(true);

    const response = await window.fixMyGame.detectGameInstall(gameKey);

    if (!response?.ok) {
      setGameInstallDetected(false);
      setGameInstallPath("");
      return;
    }

    setGameInstallDetected(Boolean(response.detected));
    setGameInstallPath(response.path || "");
  } catch {
    setGameInstallDetected(false);
    setGameInstallPath("");
  } finally {
    setCheckingInstall(false);
  }
}, [selectedGameKey]);

useEffect(() => {
  setAutoDetectStatus("idle");
  detectSelectedGameInstall(selectedGameKey);
}, [selectedGameKey, detectSelectedGameInstall]);

useEffect(() => {
  if (typeof window === "undefined") return;
  setFixHistoryItems(loadFixHistory());
}, [showFixHistoryModal, isPro]);

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

function buildSafeFixPlanPreview(params: {
  suspectMods: string[];
  selectedGameKey: string;
}) {
  const suspectMods = Array.isArray(params.suspectMods) ? params.suspectMods : [];
  const primarySuspect = suspectMods[0] || "the top matched suspect";

  return [
  {
    id: "safe_fix_mods_used",
    title: "Safe Repair: checked likely problem mods",
    detail:
      suspectMods.length > 0
        ? `FixMyGame will check these suspected mods first: ${suspectMods.join(", ")}.`
        : "FixMyGame will check the most likely suspect from your diagnostic signals.",
  },
  {
    id: "safe_fix_move_candidate",
    title: "Safe Repair: temporarily disable likely problem mod",
    detail: `FixMyGame will back up and move ${primarySuspect} into quarantine if it is the best safe match in your Mods folder.`,
  },
  {
    id: "safe_fix_backup_created",
    title: "Safe Repair: backup created first",
    detail: "FixMyGame will create a backup before moving anything.",
  },
  {
    id: "safe_fix_new_location",
    title: "Safe Repair: quarantine location saved",
    detail: "FixMyGame will save the quarantined item location so you can undo the repair later.",
  },
];
}

  async function applySafeFixNow() {
  setErrorMsg("");
  setFixPreviewError("");
  setFixExecutionResults([]);

  if (!window.fixMyGame?.applySafeFix) {
    setFixPreviewError("Safe Fix is only available inside the Electron desktop app.");
    return;
  }

  if (!gameInstallPath) {
    setFixPreviewError("No detected game install path is available for Safe Fix.");
    return;
  }

  const suspectMods = safeFixSuspects;

  if (suspectMods.length === 0) {
    setFixPreviewError("No suspected mods were available for Safe Fix.");
    return;
  }

  const safeFixCategory =
  displayAnalysis?.detectedSignals?.likelyCategory ||
  displayDetectedSignals?.likelyCategory ||
  "";

if (safeFixCategory !== "mod_conflict") {
  setFixPreviewError(
    "Safe Fix is only available for mod conflict results right now. This diagnosis needs manual steps instead."
  );
  return;
}

  try {
    setApplyingSafeFix(true);

    const response = await window.fixMyGame.applySafeFix({
      gameKey: selectedGameKey,
      installPath: gameInstallPath,
      suspectMods,
      actionLabel: "safe_fix_quarantine_mod",
    });

    if (!response?.ok) {
  const detail = response?.error || "Safe Fix failed.";

  setFixExecutionResults([
    {
      id: "safe_fix_failed",
      title: "Safe Fix failed",
      ok: false,
      detail,
    },
  ]);

  setFixPreviewError(detail);
  return;
}

const movedFile = response.movedFile || "suspected mod";

setFixExecutionResults([
  {
    id: "safe_fix_mods_used",
    title: "Safe Repair: checked likely problem mods",
    ok: true,
    detail:
      suspectMods.length > 0
        ? `Checked these suspected mods: ${suspectMods.join(", ")}.`
        : "FixMyGame checked the most likely suspect from your diagnostic signals.",
  },
  {
    id: "safe_fix_move_candidate",
    title: "Safe Repair: moved likely problem mod",
    ok: true,
    detail: `${movedFile} was backed up and moved into quarantine successfully.`,
  },
  {
    id: "safe_fix_backup_created",
    title: "Safe Repair: backup created",
    ok: true,
    detail: response.backupPath
      ? `Backup created at: ${response.backupPath}`
      : "Backup created before moving the matched item.",
  },
  {
    id: "safe_fix_new_location",
    title: "Safe Repair: new file location",
    ok: true,
    detail: response.quarantinePath
      ? `Stored quarantined file at: ${response.quarantinePath}`
      : "The matched item was moved into quarantine.",
  },
]);

setShowFixPreviewModal(false);

showActionMessage(
  `Safe Repair applied: ${movedFile} was backed up and temporarily disabled. Launch the game again, then run another diagnostic if needed.`,
  "fixAssistant"
);

    const historyText = [
      `Safe Repair applied.`,
      ``,
      `Moved File: ${movedFile}`,
      `Suspected Mods: ${suspectMods.join(", ") || "None"}`,
      `Backup Path: ${response.backupPath || "Unknown"}`,
      `Quarantine Path: ${response.quarantinePath || "Unknown"}`,
    ].join("\n");

    const nextHistory = pushFixHistoryItem({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      gameKey: selectedGameKey,
      gameTitle,
      type: "fix_plan",
      title: `${gameTitle} safe repair`,
      text: historyText,
    });

    setFixHistoryItems(nextHistory);
    setLastFixResult({
  movedFile,
  matchedName: response.matchedName,
  matchedSuspect: response.matchedSuspect,
  itemType: response.itemType,
  candidateKind: response.candidateKind,
  backupPath: response.backupPath,
  quarantinePath: response.quarantinePath,
  originalPath: response.originalPath,
  mods: suspectMods,
});
    setShowFixFeedback(true);
    pushSupportEvent("apply_safe_fix", `Applied safe fix for ${movedFile}`);
await sendSupportSnapshot(
  "apply_safe_fix",
  `Applied safe fix for ${movedFile}`
);

    await detectSelectedGameInstall(selectedGameKey);
  } catch (error) {
    setFixPreviewError(
      error instanceof Error ? error.message : "Safe Fix failed."
    );
  } finally {
    setApplyingSafeFix(false);
  }
}

  async function undoLastSafeFix() {
  setErrorMsg("");
  setFixExecutionResults([]);

  if (!window.fixMyGame?.undoLastFix) {
    setErrorMsg("Undo Last Fix is only available inside the Electron desktop app.");
    return;
  }

  try {
    setUndoingSafeFix(true);

    const response = await window.fixMyGame.undoLastFix();

   if (!response?.ok) {
  const rawDetail = response?.error || "Undo Last Fix failed.";
  const isNoUndoCase =
    rawDetail.toLowerCase().includes("no previous fix was found to undo");

  const detail = isNoUndoCase
    ? "There isn’t a recent Safe Fix to undo yet."
    : rawDetail;

  setFixExecutionResults([
    {
      id: "undo_fix_failed",
      title: isNoUndoCase ? "Nothing to undo yet" : "Undo Last Fix failed",
      ok: false,
      detail,
    },
  ]);

  if (!isNoUndoCase) {
    setErrorMsg(detail);
  } else {
    showActionMessage(detail, "fixAssistant");
  }

  return;
}

    const restoredFile = response.restoredFile || "mod";

setFixExecutionResults([
  {
    id: "undo_fix_restore",
    title: "Undo Last Fix: restored mod file",
    ok: true,
    detail: `Restored ${restoredFile} successfully.`,
  },
  {
    id: "undo_fix_location",
    title: "Undo Last Fix: returned file to original folder",
    ok: true,
    detail: response.originalPath
      ? `Returned file to: ${response.originalPath}`
      : "Returned the file to its original location.",
  },
]);

showActionMessage(
  `Undo complete: restored ${restoredFile}. You can launch the game again or run another diagnostic if needed.`,
  "fixAssistant"
);

    const historyText = [
      `Undo Last Fix completed.`,
      ``,
      `Restored File: ${restoredFile}`,
      `Restored To: ${response.originalPath || "Unknown"}`,
    ].join("\n");

    const nextHistory = pushFixHistoryItem({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      gameKey: selectedGameKey,
      gameTitle,
      type: "fix_plan",
      title: `${gameTitle} undo last fix`,
      text: historyText,
    });

    setFixHistoryItems(nextHistory);
    pushSupportEvent("undo_last_fix", `Undid last fix for ${restoredFile}`);
await sendSupportSnapshot(
  "undo_last_fix",
  `Undid last fix for ${restoredFile}`
);
    await detectSelectedGameInstall(selectedGameKey);
  } catch (error) {
    setErrorMsg(
      error instanceof Error ? error.message : "Undo Last Fix failed."
    );
  } finally {
    setUndoingSafeFix(false);
  }
}

async function openQuarantineFolder() {
  if (!lastFixResult?.quarantinePath) {
    setFixPreviewError("No quarantine path is available yet.");
    return;
  }

  try {
    const response = await window.fixMyGame?.openFolderPath?.(lastFixResult.quarantinePath);

    if (!response?.ok) {
      setFixPreviewError(response?.error || "Could not open the quarantine folder.");
      return;
    }
  } catch {
    setFixPreviewError("Could not open the quarantine folder.");
  }
}

async function openBackupFolder() {
  if (!lastFixResult?.backupPath) {
    setFixPreviewError("No backup path is available yet.");
    return;
  }

  try {
    const response = await window.fixMyGame?.openFolderPath?.(lastFixResult.backupPath);

    if (!response?.ok) {
      setFixPreviewError(response?.error || "Could not open the backup folder.");
      return;
    }
  } catch {
    setFixPreviewError("Could not open the backup folder.");
  }
}

  async function loadLogFromComputer() {
    setErrorMsg("");
    setAutoDetectStatus("idle");

    if (!window.fixMyGame?.pickLogFile || !window.fixMyGame?.readLogFile) {
      setErrorMsg("Desktop file loading is only available inside the Electron app.");
      return;
    }

    try {
      setLoadingDesktopLog(true);

      const filePath = await window.fixMyGame.pickLogFile();
      if (!filePath) return;

      const contents = await window.fixMyGame.readLogFile(filePath);
      setHasAppliedAutoGameDetect(false);
      setCurrentLogPath(filePath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

applyDetectedGameOnce(detectedGame);

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
  setAutoDetectStatus("idle");

  if (!window.fixMyGame?.pickScanFolder || !window.fixMyGame?.scanCustomFolder) {
    setErrorMsg("Folder scanning is only available inside the Electron app.");
    return;
  }

  try {
    const defaultScanPath =
  gameInstallPath ||
  currentLogPath ||
  "";

const folderPath = await window.fixMyGame.pickScanFolder(defaultScanPath);
    if (!folderPath) return;

    const logs = await window.fixMyGame.scanCustomFolder(folderPath, selectedGameKey);
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
    setHasAppliedAutoGameDetect(false);
setCurrentLogPath(bestLog.fullPath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

applyDetectedGameOnce(detectedGame);

setCrashLog(contents);
setQuickSignals(quickDetect(contents, activeGameKey));
setLogHighlights(extractLogHighlights(contents, activeGameKey));
setLiveMods(extractModsFromLog(contents, activeGameKey));
setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));

showActionMessage(
  buildLoadedLogSummary({
    crashLog: contents,
  }) || `Loaded latest ${gameTitle} log.`,
  "fixAssistant"
);
  } catch {
    setErrorMsg("Failed to scan the selected folder.");
  }
}

async function scanLogsForSelectedGame() {
  setErrorMsg("");
  setAutoDetectStatus("idle");

  if (!window.fixMyGame?.scanLogsForGame) {
    setErrorMsg("Desktop connection not detected. Restart the Electron app and try again.");
    return;
  }

  try {
    setScanningLogs(true);

    let installDetected = false;

      try {
        if (window.fixMyGame?.detectGameInstall) {
          const installResponse = await window.fixMyGame.detectGameInstall(selectedGameKey);
          installDetected = !!installResponse?.detected;
        }
      } catch {
        installDetected = false;
      }

    const logs = await window.fixMyGame.scanLogsForGame(selectedGameKey);
    const normalizedLogs = Array.isArray(logs) ? logs : [];

setDetectedLogs(normalizedLogs);
setHasScannedLogs(true);

if (normalizedLogs.length === 0) {
  setActionMsg("");
  setAutoDetectStatus(installDetected ? "no_logs" : "not_installed");
  return;
}

setAutoDetectStatus("logs_found");

// AUTO-SELECT BEST LOG
if (normalizedLogs.length > 0) {
  const bestLog = normalizedLogs[0];

  if (!window.fixMyGame?.readLogFile) {
    setErrorMsg("Desktop file loading is only available inside the Electron app.");
    return;
  }

  const contents = await window.fixMyGame.readLogFile(bestLog.fullPath);
  setHasAppliedAutoGameDetect(false);
  setCurrentLogPath(bestLog.fullPath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

applyDetectedGameOnce(detectedGame);

setCrashLog(contents);
setQuickSignals(quickDetect(contents, activeGameKey));
setLogHighlights(extractLogHighlights(contents, activeGameKey));
setLiveMods(extractModsFromLog(contents, activeGameKey));
setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));

showActionMessage(
  buildLoadedLogSummary({
    crashLog: contents,
  }) || `Loaded latest ${gameTitle} log.`,
  "fixAssistant"
);
}

  } catch {
  setErrorMsg(`Could not scan for ${gameTitle} logs. Restart the desktop app and try again.`);
} finally {
    setScanningLogs(false);
  }
}

async function loadDetectedLog(fullPath: string) {
  setErrorMsg("");
  setAutoDetectStatus("idle");

  if (!window.fixMyGame?.readLogFile) {
    setErrorMsg("Desktop file loading is only available inside the Electron app.");
    return;
  }

  try {
    setLoadingDesktopLog(true);

const contents = await window.fixMyGame.readLogFile(fullPath);
setHasAppliedAutoGameDetect(false);
setCurrentLogPath(fullPath);
const detectedGame = detectGameFromLog(contents);
const activeGameKey = detectedGame || selectedGameKey;

applyDetectedGameOnce(detectedGame);

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

async function openModsFolder(
  silent = false,
  errorTarget: "top" | "quickActions" = "top"
) {
  if (!silent) {
  setErrorMsg("");
  setActionMsg("");
  if (errorTarget === "top") {
    setFolderActionError("");
  } else {
    setQuickActionFolderError("");
  }
}

  if (!window.fixMyGame?.openModsFolder) {
    if (!silent) {
      if (errorTarget === "top") {
  setTimedError(setFolderActionError, "Open Mods Folder is only available inside the Electron app.");
} else {
  setTimedError(setQuickActionFolderError, "Open Mods Folder is only available inside the Electron app.");
}
    }
    return false;
  }

  try {
    const response = await window.fixMyGame.openModsFolder(selectedGameKey);

    if (!response?.ok) {
      const error = (response?.error || "").toLowerCase();

      if (!silent) {
        if (error.includes("not found") || error.includes("no such file")) {
          if (errorTarget === "top") {
            setFolderActionError(`No ${gameTitle} installation detected on this device.`);
          } else {
            setQuickActionFolderError(`No ${gameTitle} installation detected on this device.`);
          }
        } else if (error.includes("empty") || error.includes("no mods")) {
          if (errorTarget === "top") {
  setTimedError(setFolderActionError, 
    `${gameTitle} is installed, but no mods folder was found or it is empty.`
  );
} else {
  setTimedError(setQuickActionFolderError,
    `${gameTitle} is installed, but no mods folder was found or it is empty.`
  );
}
        } else {
          if (errorTarget === "top") {
            setTimedError(setFolderActionError,
              response?.error || `Could not open the ${gameTitle} mods folder.`
            );
          } else {
            setTimedError(setQuickActionFolderError,
              response?.error || `Could not open the ${gameTitle} mods folder.`
            );
          }
        }
      }

      return false;
    }

    if (!silent) {
      showActionMessage(
  `Opened ${gameTitle} mods folder: ${response.path}`,
  "fixAssistant"
);
    }

    return true;
  } catch (error: unknown) {
    if (!silent) {
      const msg =
        error instanceof Error
          ? error.message
          : `Failed to open the ${gameTitle} mods folder.`;
      if (errorTarget === "top") {
  setFolderActionError(msg);
} else {
  setQuickActionFolderError(msg);
}
    }

    return false;
  }
}

async function openLogsFolder(
  silent = false,
  errorTarget: "top" | "quickActions" = "top"
) {
  if (!silent) {
  setErrorMsg("");
  setActionMsg("");
  if (errorTarget === "top") {
    setFolderActionError("");
  } else {
    setQuickActionFolderError("");
  }
}

  if (!window.fixMyGame?.openLogsFolder) {
    if (!silent) {
      if (errorTarget === "top") {
  setTimedError(setFolderActionError, "Open Logs Folder is only available inside the Electron app.");
} else {
  setTimedError(setQuickActionFolderError, "Open Logs Folder is only available inside the Electron app.");
}
    }
    return false;
  }

  try {
    const response = await window.fixMyGame.openLogsFolder(selectedGameKey);

    if (!response?.ok) {
      const error = (response?.error || "").toLowerCase();

      if (!silent) {
        if (error.includes("not found") || error.includes("no such file")) {
          if (errorTarget === "top") {
  setTimedError(setFolderActionError, `No ${gameTitle} installation detected on this device.`);
} else {
  setTimedError(setQuickActionFolderError, `No ${gameTitle} installation detected on this device.`);
}
        } else if (error.includes("empty") || error.includes("no logs")) {
          if (errorTarget === "top") {
  setTimedError(setFolderActionError,
    `${gameTitle} is installed, but no crash logs were found yet. Launch the game once or generate a crash.`
  );
} else {
  setTimedError(setQuickActionFolderError,
    `${gameTitle} is installed, but no crash logs were found yet. Launch the game once or generate a crash.`
  );
}
        } else {
          if (errorTarget === "top") {
  setTimedError(setFolderActionError,
    response?.error || `Could not open the ${gameTitle} logs folder.`
  );
} else {
  setTimedError(setQuickActionFolderError,
    response?.error || `Could not open the ${gameTitle} logs folder.`
  );
}
        }
      }

      return false;
    }

    if (!silent) {
      showActionMessage(`Opened ${gameTitle} logs folder: ${response.path}`, "fixAssistant");
    }

    return true;
  } catch (error: unknown) {
    if (!silent) {
      const msg =
        error instanceof Error
          ? error.message
          : `Failed to open the ${gameTitle} logs folder.`;
      if (errorTarget === "top") {
  setFolderActionError(msg);
} else {
  setQuickActionFolderError(msg);
}
    }

    return false;
  }
}

function pushSupportEvent(type: string, detail?: string) {
  setSupportEventHistory((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      detail,
    },
  ]);
}

function buildSupportSnapshot(params?: {
  eventType?: string;
  eventDetail?: string;
}) {
  return {
    createdAt: new Date().toISOString(),
    sessionId: supportSessionId,
    appVersion: "1.0.0",
    eventType: params?.eventType || "manual_snapshot",
    eventDetail: params?.eventDetail || "",
    consent: {
      supportTelemetryEnabled,
      authorizationAccepted: hasAcceptedAuthorization,
    },
    game: {
      key: selectedGameKey,
      title: gameTitle,
    },
    system: {
      gpuModel,
      driverVersion,
      graphicsApiMode,
    },
    paths: {
      currentLogPath,
      gameInstallPath,
      gameInstallDetected,
      backupPath: lastFixResult?.backupPath || "",
      quarantinePath: lastFixResult?.quarantinePath || "",
      originalPath: lastFixResult?.originalPath || "",
    },
    diagnostic: {
      crashLog,
      quickSignals,
      logHighlights,
      liveMods,
      mostSuspiciousLine,
      detectedSignals: displayDetectedSignals,
      analysis: displayAnalysis,
      smartFixPath,
      result,
      loadedLogSummary,
    },
    continuation: {
      continuedDiagnosticBase,
      diagnosticRefineMode,
      diagnosticRefineText,
      additionalRefineLog,
      showDiagnosticRefineBox,
      resultFollowupMessage,
      resultFollowupTone,
    },
    safeFix: {
      fixExecutionResults,
      lastFixResult,
      showFixFeedback,
    },
    limits: {
      isPro,
      remaining,
      limit,
    },
    ui: {
      desktopConnected,
      betaOpen,
      betaMessage,
      checkingInstall,
      running,
      scanningLogs,
      loadingDesktopLog,
      applyingSafeFix,
      undoingSafeFix,
      runningFixPlan,
    },
    supportEvents: [
      ...supportEventHistory,
      {
        id: crypto.randomUUID(),
        type: params?.eventType || "manual_snapshot",
        createdAt: new Date().toISOString(),
        detail: params?.eventDetail || "",
      },
    ],
  };
}

async function sendSupportSnapshot(eventType: string, eventDetail?: string) {
  if (!supportTelemetryEnabled) return;

  try {
    const snapshot = buildSupportSnapshot({
      eventType,
      eventDetail,
    });

    const response = await fetchJSON<{ ok: boolean; skipped?: boolean; id?: string; error?: string }>(
  `${API_BASE_URL}/api/support-snapshot`,
  {
    method: "POST",
    body: JSON.stringify(snapshot),
  }
);

    console.log("Support snapshot sent:", response);
  } catch (error) {
    console.error("Support snapshot failed:", error);
    setErrorMsg(
      error instanceof Error
        ? `Support snapshot failed: ${error.message}`
        : "Support snapshot failed."
    );
  }
}

  async function runDiagnostic(
  overrideCrashLog?: string,
  options?: { autoScroll?: boolean }
) {
    setErrorMsg("");
    setResult("");

    setDetectedSignals(null);
    setAnalysis(null);
    
    const logToUse = overrideCrashLog ?? crashLog;
    const autoScroll = options?.autoScroll ?? true;

if (typeof logToUse !== "string" || !logToUse.trim()) {
  setErrorMsg("Paste a crash log / error first.");
  return;
}

if (!betaOpen) {
  setErrorMsg(betaMessage || "The FixMyGame beta period has ended.");
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
  crashLog: logToUse,
  mostSuspiciousLine,
  quickSignals,
  logHighlights,
  liveMods,
  currentLogPath,
  resultRefinement:
  showDiagnosticRefineBox && diagnosticRefineMode
    ? {
        mode: diagnosticRefineMode,
        userMessage: diagnosticRefineText.trim(),
      }
    : null,
  continuedDiagnostic: continuedDiagnosticBase
    ? {
        title: continuedDiagnosticBase.title,
        gameKey: continuedDiagnosticBase.gameKey,
        gameTitle: continuedDiagnosticBase.gameTitle,
        issue: continuedDiagnosticBase.analysisSummary?.issue || "",
        quickFixFirst:
          continuedDiagnosticBase.analysisSummary?.quickFixFirst || "",
        mostLikelyCause:
          continuedDiagnosticBase.analysisSummary?.mostLikelyCause || "",
        needMoreInfo:
          continuedDiagnosticBase.analysisSummary?.needMoreInfo || "",
        likelyCategory:
          continuedDiagnosticBase.analysisSummary?.likelyCategory || "",
        suspectedMods:
          continuedDiagnosticBase.analysisSummary?.suspectedMods || [],
        previousText: continuedDiagnosticBase.text,
        previousRelevantLog:
          continuedDiagnosticBase.analysisSummary?.previousRelevantLog || "",
      }
    : null,
};

    const data = await fetchJSON<AnalyzeResponse>("/api/analyze", {
  method: "POST",
  body: JSON.stringify(payload),
});

const nextResult = data.result || "";
const nextAnalysis = data.analysis ?? null;
const nextDetectedSignals = data.detectedSignals ?? null;

setResult(nextResult);
setHasRunDiagnosticThisSession(true);
setShouldAutoScrollToResult(autoScroll);
setAnalysis(nextAnalysis);
setDetectedSignals(nextDetectedSignals);
setShowDiagnosticRefineBox(false);
setDiagnosticRefineMode(null);
setDiagnosticRefineText("");
setShowAdditionalRefineLogBox(false);
setAdditionalRefineLog("");

const diagnosticHistoryText = buildDiagnosticResultText(
  nextAnalysis,
  nextResult
);

if (diagnosticHistoryText.trim()) {
  addToFixHistory(
  "diagnostic_run",
  `${gameTitle} diagnostic run`,
  diagnosticHistoryText,
  {
    issue: nextAnalysis?.issue,
    quickFixFirst: nextAnalysis?.quickFixFirst,
    mostLikelyCause: nextAnalysis?.mostLikelyCause,
    needMoreInfo: nextAnalysis?.needMoreInfo,
    likelyCategory:
      nextAnalysis?.detectedSignals?.likelyCategory ||
      nextDetectedSignals?.likelyCategory,
    suspectedMods:
      nextAnalysis?.detectedSignals?.suspectedMods ||
      nextDetectedSignals?.suspectedMods ||
      [],
    previousRelevantLog: logToUse,
  }
);
pushSupportEvent("run_diagnostic", `Ran diagnostic for ${gameTitle}`);
await sendSupportSnapshot("run_diagnostic", `Ran diagnostic for ${gameTitle}`);
}

      const lim = await fetchJSON<LimitResponse>(
  `${API_BASE_URL}/api/limit?t=${Date.now()}`,
  {
    method: "GET",
    cache: "no-store",
  }
);

setIsPro(Boolean(lim.isPro));
setIsBetaAccess(Boolean(lim.isBeta));
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
    const data = await fetchJSON<CheckoutResponse>("/api/checkout", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (!data?.url || typeof data.url !== "string") {
      throw new Error("Checkout failed. No Stripe checkout link was returned.");
    }

    window.location.assign(data.url);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Checkout failed.";
    setErrorMsg(msg);
  }
}
function buildDiagnosticResultText(
  analysisValue: AnalyzeResponse["analysis"] | null,
  resultValue: string
) {
  return analysisValue
    ? [
        "Quick Fix First:",
        analysisValue.quickFixFirst,
        "",
        `Issue: ${analysisValue.issue}`,
        `Confidence Level: ${analysisValue.confidenceLevel}`,
        "Probability Breakdown:",
        ...analysisValue.probabilityBreakdown.map((item) => `- ${item}`),
        `Most Likely Cause: ${analysisValue.mostLikelyCause}`,
        "Recommended Fix Steps:",
        ...analysisValue.recommendedFixSteps.map(
          (step, index) => `${index + 1}. ${step}`
        ),
        `Need More Info: ${analysisValue.needMoreInfo}`,
      ].join("\n")
    : resultValue;
}

async function saveResult() {
  if (!window.fixMyGame?.saveAnalysis) {
    setErrorMsg("Save is only available inside the Electron app.");
    return;
  }

  const textToSave = buildDiagnosticResultText(displayAnalysis, result);

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
}, 2500);
  } catch {
    setErrorMsg("Failed to save analysis.");
  }
}

async function copyResult() {
  const textToCopy = buildDiagnosticResultText(displayAnalysis, result);

  if (!textToCopy.trim()) return;

  addToFixHistory("full_result", `${gameTitle} diagnostic result`, textToCopy);

  try {
    await copyTextReliable(textToCopy);
    setCopied(true);
    showActionMessage("Copied to system clipboard and saved to Fix History.", "diagnostic");
setTimeout(() => {
  setCopied(false);
}, 4000);
  } catch (error: unknown) {
    setCopied(false);
    showActionMessage(
  "Saved to Fix History. System clipboard copy failed on this device.",
  "diagnostic"
);

    setErrorMsg(
      error instanceof Error ? error.message : "Failed to copy result."
    );
  }
}

function resetSavedSystemPrefs() {
  try {
    localStorage.removeItem(SYSTEM_PREFS_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }

  setSelectedGameKey("minecraft");
  setGpuModel("");
  setDriverVersion("");
  setGraphicsApiMode("Auto Detect");
}

async function applyQuickFix() {
  if (!displayAnalysis) {
    setErrorMsg("Run a diagnostic first.");
    return;
  }

  const quickFixText = [
    `Quick Fix First: ${displayAnalysis.quickFixFirst}`,
    "",
    "Recommended Fix Steps:",
    ...displayAnalysis.recommendedFixSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");

  addToFixHistory("quick_fix", `${gameTitle} quick fix`, quickFixText);

  try {
    await copyTextReliable(quickFixText);
    setShowFixPreviewModal(false);
    showActionMessage("Quick fix copied to clipboard and saved to Fix History.", "fixAssistant");
  } catch (error: unknown) {
    setShowFixPreviewModal(false);
    showActionMessage("Quick fix saved to Fix History. System clipboard copy failed on this device.", "fixAssistant");

    setErrorMsg(
      error instanceof Error ? error.message : "Failed to copy quick fix."
    );
  }
}
async function runFixPlan() {
  if (!fixPlan || !displayAnalysis) {
    setErrorMsg("Run a diagnostic first.");
    return;
  }

  setRunningFixPlan(true);
  setErrorMsg("");
  setActionMsg("");
  setFixExecutionResults([]);

    addToFixHistory(
    "fix_plan",
    `${gameTitle} fix plan`,
    [
      fixPlan.title,
      "",
      fixPlan.description,
      "",
      ...fixPlan.actions.map(
        (action, index) =>
          `${index + 1}. ${action.title} — ${action.description} [${action.risk} risk]`
      ),
    ].join("\n")
  );

  const results: FixExecutionResult[] = [];

  for (const action of fixPlan.actions) {
    if (action.type === "open_mods_folder") {
      const ok = await openModsFolder(true);
      results.push({
        id: action.id,
        title: action.title,
        ok,
        detail: ok
  ? "Mods folder opened successfully."
  : `Could not open the ${gameTitle} mods folder because no local game install was found on this device.`,
      });
      continue;
    }

    if (action.type === "open_logs_folder") {
      const ok = await openLogsFolder(true);
      results.push({
        id: action.id,
        title: action.title,
        ok,
        detail: ok
  ? "Logs folder opened successfully."
  : `Could not open the ${gameTitle} logs folder because no local game install was found on this device.`,
      });
      continue;
    }

    if (action.type === "copy_fix_steps") {
      const quickFixText = [
        `Quick Fix First: ${displayAnalysis.quickFixFirst}`,
        "",
        "Recommended Fix Steps:",
        ...displayAnalysis.recommendedFixSteps.map((step, index) => `${index + 1}. ${step}`),
      ].join("\n");

      try {
        await copyTextReliable(quickFixText);
        results.push({
          id: action.id,
          title: action.title,
          ok: true,
          detail: "Fix steps copied to clipboard.",
        });
      } catch (error: unknown) {
        results.push({
          id: action.id,
          title: action.title,
          ok: false,
          detail:
            error instanceof Error ? error.message : "Failed to copy fix steps.",
        });
      }
    }
  }

  setFixExecutionResults(results);
  setRunningFixPlan(false);
  setShowFixPreviewModal(false);

  const successCount = results.filter((r) => r.ok).length;
  const totalCount = results.length;

  showActionMessage(`Fix plan finished: ${successCount}/${totalCount} safe actions completed.`, "fixAssistant");
}

function openStepByStepGuide() {
  if (!displayAnalysis) {
    setErrorMsg("Run a diagnostic first.");
    return;
  }

  setShowFixGuide(true);
}

function deleteFixHistoryItem(id: string) {
  const next = fixHistoryItems.filter((item) => item.id !== id);
  setFixHistoryItems(next);
  saveFixHistory(next);
}

function clearFixHistory() {
  const confirmed = window.confirm(
    "Are you sure? This will permanently delete all Fix History entries on this device."
  );

  if (!confirmed) return;

  setFixHistoryItems([]);
  saveFixHistory([]);
}

async function openGameSettingsQuickAction() {
  setErrorMsg("");
  setActionMsg("");
    if (currentLogPath && window.fixMyGame?.openFolderPath) {
    try {
      const response = await window.fixMyGame.openFolderPath(currentLogPath);

      if (response?.ok) {
        showActionMessage(`Opened the folder for your loaded ${gameTitle} log.`, "fixAssistant");
        return;
      }
    } catch {
      // fall through to normal game folder logic
    }
  }

  const hasDetectedGame =
    Boolean(gameInstallDetected) ||
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
  if (!hasScannedLogs && !crashLog.trim()) {
    // User hasn't done anything yet → don't show error
    return;
  }

  setErrorMsg(`No ${gameTitle} installation or crash logs were detected on this device yet.`);
  return;
}

  if (selectedGameKey === "minecraft") {
    const openedLogs = await openLogsFolder(true);
    if (openedLogs) {
      showActionMessage(`Opened ${gameTitle} crash logs folder.`, "fixAssistant");
      return;
    }

    const openedMods = await openModsFolder(true);
    if (openedMods) {
      showActionMessage(`Opened ${gameTitle} mods folder.`, "fixAssistant");
      return;
    }

    if (!crashLog.trim() && detectedLogs.length === 0) {
      setErrorMsg(
        `No ${gameTitle} installation or crash logs were detected on this device yet.`
      );
    } else {
      showActionMessage(
  `${gameTitle} was detected from your loaded log, but no local game folder could be opened on this device.`,
  "fixAssistant"
);
    }

    return;
  }

  if (selectedGameProfile.supportsModsFolder) {
    const openedMods = await openModsFolder(true);
    if (openedMods) {
      showActionMessage(`Opened ${gameTitle} mods folder.`, "fixAssistant");
      return;
    }
  }

  if (selectedGameProfile.supportsLogsFolder) {
    const openedLogs = await openLogsFolder(true);
    if (openedLogs) {
      showActionMessage(`Opened ${gameTitle} logs folder.`, "fixAssistant");
      return;
    }
  }

  if (!crashLog.trim() && detectedLogs.length === 0) {
    setErrorMsg(
      `No ${gameTitle} installation or crash logs were detected on this device yet.`
    );
  } else {
    showActionMessage(
  `${gameTitle} was detected from your loaded log, but no local game folder could be opened on this device.`,
  "fixAssistant"
);
  }
}
if (checkingBetaStatus) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-sm text-white/50">Checking beta access...</div>
    </main>
  );
}

if (!betaOpen) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg rounded-3xl border border-red-500/20 bg-black p-8 text-center shadow-2xl">
        <h1 className="text-3xl font-extrabold">FixMyGame Beta Closed</h1>
        <p className="mt-4 text-white/70">
          {betaMessage || "This beta build is currently unavailable."}
        </p>
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/50 break-all">
  API base: {API_BASE_URL}
</p>

<button
  type="button"
  onClick={fetchBetaStatus}
  className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
>
  Recheck Beta Access
</button>
      </div>
    </main>
  );
}

return (
  <main className="mx-auto w-full max-w-[900px] px-4 py-12 text-white">
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-4xl font-extrabold tracking-tight">
        FixMyGame: AI Crash Diagnostics for Modded Games
      </h1>

      <p className="mt-3 max-w-3xl text-white/80">
        Diagnose crash logs and mod conflicts for Minecraft, The Sims 4, Skyrim,
        Fallout 4, and other modded PC games. Detect dependency issues, plugin
        failures, loader mismatches, and GPU/driver faults.
      </p>
    </div>

    <button
      type="button"
      onClick={() => {
        setSettingsTab("privacy");
        setShowSettingsModal(true);
      }}
      className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg text-white/80 transition hover:bg-white/10 hover:text-white"
      aria-label="Open settings"
      title="Settings"
    >
      ⚙️
    </button>
  </div>

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
    {isPro ? "Pro Plan" : isBetaAccess ? "Beta: Unlimited" : "Free Plan"}
  </span>

  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
    {loadingLimit
      ? "Checking usage..."
      : isPro || isBetaAccess
      ? "Unlimited beta access enabled"
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
  <span
  className={[
    "rounded-full px-3 py-1 text-xs font-medium",
    checkingInstall
      ? "border border-white/10 bg-white/5 text-white/70"
      : gameInstallDetected
      ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border border-white/10 bg-white/5 text-white/70",
  ].join(" ")}
>
  {checkingInstall
    ? `Checking ${gameTitle} install...`
    : gameInstallDetected
    ? `${gameTitle} Detected`
    : `No ${gameTitle} Install Detected`}
</span>
</div>

{process.env.NODE_ENV !== "production" ? (
  <div className="mt-3 p-3 rounded-lg bg-white/5 text-xs leading-relaxed break-words">
    <div><strong>Local vid:</strong> {debugVid || "none"}</div>
    <div><strong>Server debug:</strong> {debugProStatus || "loading..."}</div>
    <div>
      <strong>Install detection:</strong>{" "}
      {checkingInstall
        ? "checking..."
        : gameInstallDetected
        ? gameInstallPath || "detected"
        : "not detected"}
    </div>
  </div>
) : null}

<section className="mt-10 rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.55)] p-5">
<Field label="SELECTED GAME">
  <DarkSelect
    value={gameTitle}
    options={SORTED_GAME_PRESETS.map((g) => g.label)}
    onChange={(label) => {
  const match = SORTED_GAME_PRESETS.find((g) => g.label === label);
  if (match) {
    setSelectedGameKey(match.key);
    setHasAppliedAutoGameDetect(true);
  }
}}
  />
</Field>

<div className="mt-3 flex justify-end">
  <button
    type="button"
    onClick={autoFillSystemSpecs}
    disabled={detectingSystemSpecs}
    className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {detectingSystemSpecs ? "Detecting..." : "Auto-Fill System Info"}
  </button>
</div>

        <div className="-mt-7">
          <Field label="GPU MODEL">
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0b1220] text-white px-4 py-3 outline-none focus:border-white/20 appearance-none"

              value={gpuModel}
              onChange={(e) => setGpuModel(e.target.value)}
              placeholder="RTX 3070 / RX 6800"
            />
          </Field>
          </div>

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

<div className="mt-3 flex flex-wrap gap-3">
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
    if (!isPro && !isBetaAccess) {
      setProModalContext("autoDetect");
      setShowProModal(true);
      return;
    }

    scanLogsForSelectedGame();
  }}
  disabled={scanningLogs || !selectedGameProfile.supportsAutoDetect}
  className={[
    "rounded-xl px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
    isPro || isBetaAccess
      ? "bg-cyan-600 hover:bg-cyan-500"
      : "bg-amber-500/10 text-amber-200 border border-amber-400/20 hover:bg-amber-500/15",
  ].join(" ")}
>
  {scanningLogs
  ? "Scanning..."
  : selectedGameProfile.supportsAutoDetect
  ? isPro || isBetaAccess
    ? `Auto Detect ${gameTitle} Logs`
    : `Auto Detect ${gameTitle} Logs (Pro)`
    : `Auto Detect ${gameTitle} Logs Not Available Yet`}
</button>
<button
  type="button"
onClick={() => {
  if (!isPro && !isBetaAccess) {
    setProModalContext("folderScan");
    setShowProModal(true);
    return;
  }

  pickCustomScanFolder();
}}
  className={[
    "rounded-xl px-4 py-2 font-medium transition",
    isPro || isBetaAccess
      ? "bg-white/10 hover:bg-white/15"
      : "bg-amber-500/10 text-amber-200 border border-amber-400/20 hover:bg-amber-500/15",
  ].join(" ")}
>
  {isPro || isBetaAccess ? "Scan Entire Folder" : "Scan Entire Folder (Pro)"}
</button>
</div>

{actionMsg && actionMsgLocation === "fixAssistant" ? (
  <div className="mt-3 mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
    {actionMsg}
  </div>
) : null}

{detectedLogs.length > 0 ? (
  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="text-xs font-semibold tracking-widest text-white/70">
      DETECTED LOGS
    </div>

    <div className="mt-3 grid gap-2 max-h-[420px] overflow-y-auto pr-2">
  {detectedLogs.map((log) => (
        <button
          key={log.fullPath}
          type="button"
          onClick={() => loadDetectedLog(log.fullPath)}
          className="w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
        >
          <div className="font-medium text-white truncate">{log.name}</div>
          <div className="mt-1 text-xs text-white/50 break-all">{log.fullPath}</div>
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

{folderActionError ? (
  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-100">
    {folderActionError}
  </div>
) : null}

{selectedGameProfile.supportsAutoDetect &&
 !crashLog.trim() &&
 !errorMsg &&
 hasScannedLogs &&
 (autoDetectStatus === "no_logs" || autoDetectStatus === "not_installed") ? (
  <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
    No log loaded yet. Some games only create a fresh log after you launch the game at least once this session.
  </div>
) : null}

{hasScannedLogs && detectedLogs.length === 0 ? (
  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
    {autoDetectStatus === "not_installed" ? (
      <>
        {gameTitle} does not appear to be installed on this device yet. Install it first, or use &ldquo;Load Crash Log From Computer&rdquo; or &ldquo;Scan Entire Folder&rdquo; if your logs are stored somewhere custom.
      </>
    ) : (
      <>
        No {gameTitle} logs were found in the detected folders yet. {gameTitle} may be installed, but no logs have been created yet. Try &ldquo;Load Crash Log From Computer&rdquo; or &ldquo;Scan Entire Folder&rdquo;.
      </>
    )}
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
  setAutoDetectStatus("idle");

  const detectedGame = detectGameFromLog(value);
  const shouldAutoSwitchGame =
    detectedGame &&
    detectedGame !== selectedGameKey &&
    !hasAppliedAutoGameDetect;

  const activeGameKey = shouldAutoSwitchGame
    ? detectedGame
    : selectedGameKey;

  if (shouldAutoSwitchGame) {
    setSelectedGameKey(detectedGame);
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
          <div className="mt-4 space-y-3">
  {quickSignals.status || quickSignals.session || quickSignals.loader || quickSignals.java || quickSignals.issue || quickSignals.error ? (
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        LIVE DETECTION
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
                {quickSignals.status ? (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Status: {quickSignals.status}
          </span>
        ) : null}

        {quickSignals.session ? (
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
            Session: {quickSignals.session}
          </span>
        ) : null}
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

        {quickSignals.issue ? (
  <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-200">
    Issue: {quickSignals.issue}
  </span>
) : null}

{quickSignals.error && quickSignals.error !== quickSignals.issue ? (
  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75">
    Technical: {quickSignals.error}
  </span>
) : null}
      </div>
    </div>
  ) : null}

  {logHighlights.length > 0 ? (
  <details className="group rounded-2xl border border-white/10 bg-black/20 p-4">
    <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-semibold tracking-widest text-white/70">
  <span>LOG HIGHLIGHTS</span>

  <span className="text-white/40 text-sm transition-transform duration-200 group-open:rotate-180">
    ▼
  </span>
</summary>

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
  </details>
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

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm text-white/90">
        {mostSuspiciousLine}
      </div>
    </div>
  ) : null}
</div>

        <div className="mt-6">
          {continuedDiagnosticBase ? (
  <div className="mb-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-3">
    <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
      CONTINUING DIAGNOSTIC
    </div>

    <div className="mt-1 text-sm text-white">
      Using previous result:{" "}
      <span className="font-semibold">{continuedDiagnosticBase.title}</span>
    </div>

    <div className="mt-1 text-xs text-white/60">
      {continuedDiagnosticBase.analysisSummary?.issue ||
        "Previous diagnostic loaded as comparison base."}
    </div>

    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          setContinuedDiagnosticBase(null);
          showActionMessage("Continuation mode cleared.", "diagnostic");
        }}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Clear Continuation
      </button>
    </div>
  </div>
) : null}
          <button
  id="run-diagnostic-button"
  className={[
    "flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-lg font-semibold transition",
    canRun && !running ? "bg-blue-600 hover:bg-blue-500" : "bg-blue-900/60 text-white/60",
  ].join(" ")}
  onClick={() => runDiagnostic()}
  disabled={!canRun || running}
>
    {running ? (
    <>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      Running Diagnostic...
    </>
  ) : !canRun && !isPro ? (
    "Free Limit Reached — Upgrade to Pro"
  ) : (
    `Run ${gameTitle} Diagnostic`
  )}
</button>

{actionMsg && actionMsgLocation === "diagnostic" ? (
  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-100">
    {actionMsg}
  </div>
) : null}

          <div className="mt-2 flex items-center justify-between text-sm text-white/70">
            <div>
              {loadingLimit ? (
                "Checking daily limit..."
              ) : isPro ? (
                "Pro: Unlimited"
              ) : (
                <>
                  {isBetaAccess ? (
  "Unlimited beta access enabled"
) : (
  <>
    Free diagnostics left today:{" "}
    <span className="font-semibold">{remaining}</span> / {limit}
  </>
)}
                </>
              )}
            </div>

            {!isPro && !isBetaAccess && (
  <button
    type="button"
    className="underline underline-offset-4 hover:text-white"
    onClick={upgradeToPro}
  >
    Upgrade to Pro
  </button>
)}
          </div>

{!loadingLimit && !isPro && remaining <= 0 ? (
  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/40 p-4 text-sm text-amber-100">
    <div className="font-semibold">
      You’ve used all free diagnostics today.
    </div>
    <div className="mt-1 text-amber-100/90">
  Unlock unlimited diagnostics, automatic log discovery, full-folder scanning, saved analysis exports, and a faster troubleshooting workflow with Pro.
</div>
  </div>
) : null}
{errorMsg ? (
  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
    {errorMsg}
  </div>
) : null}
{/* 🔥 FIX ASSISTANT */}
<div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
    FIX ASSISTANT
  </div>

  <div className="mt-3 grid gap-2">
  <button
    type="button"
    onClick={applyQuickFix}
    disabled={!hasDiagnosticResult}
    className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
  >
    ⚡ Copy Recommended Fix
  </button>

    <button
  type="button"
  onClick={() => {
    setCurrentGuideStep(0);
    setCompletedGuideSteps([]);
    openStepByStepGuide();
  }}
  disabled={!hasDiagnosticResult}
  className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
>
  🧭 View Step-by-Step Guide
</button>

  <div className="rounded-xl bg-black/20 px-4 py-3 text-left text-white">
  <button
    type="button"
    onClick={() => {
      if (!fixPlan) {
        setErrorMsg("Run a diagnostic first.");
        return;
      }
      setFixPreviewError("");
      setShowFixPreviewModal(true);
    }}
    disabled={!hasDiagnosticResult || !fixPlan}
    className="w-full text-left text-white transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
  >
    🛠️ Safe Repair
  </button>

  <p className="mt-2 ml-6 text-xs text-white/60">
  FixMyGame backs up files first and only applies supported safe fixes.
</p>
</div>

<button
  type="button"
  onClick={undoLastSafeFix}
  disabled={!canUndoLastFix || undoingSafeFix}
  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4 text-left text-white transition hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-60"
>
  {undoingSafeFix ? "↩ Undoing Last Fix..." : "↩ Undo Last Fix"}
</button>

    <button
    type="button"
    onClick={() => setShowFixHistoryModal(true)}
    className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30"
  >
    🗂️ Open Fix History
  </button>

  <button
    type="button"
    onClick={openGameSettingsQuickAction}
    className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30"
  >
    📂 Open Game Folder
  </button>
  </div>

  <div className="mt-3 text-xs text-white/55">
    FixMyGame can explain the fix, guide you through it, or safely handle supported fixes for you.
  </div>
</div>

{fixExecutionResults.length > 0 ? (
  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
    <div className="text-xs font-semibold tracking-widest text-white/60">
      FIX RESULTS
    </div>

    <div className="mt-3 grid gap-2">
      {fixExecutionResults.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-white">{item.title}</div>
            <span
              className={[
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                item.ok
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300",
              ].join(" ")}
            >
              {item.ok ? "Done" : "Failed"}
            </span>
          </div>

          <div className="mt-2 text-sm text-white/70">{item.detail}</div>
        </div>
      ))}
    </div>

    <div className="mt-4 flex flex-wrap justify-end gap-2">
  <button
    type="button"
    onClick={openBackupFolder}
    disabled={!lastFixResult?.backupPath}
    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
  >
    Open Backup Folder
  </button>

  <button
    type="button"
    onClick={openQuarantineFolder}
    disabled={!lastFixResult?.quarantinePath}
    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
  >
    Open Quarantine Folder
  </button>

  <button
    type="button"
    onClick={undoLastSafeFix}
    disabled={undoingSafeFix}
    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
  >
    {undoingSafeFix ? "Undoing..." : "Undo Last Fix"}
  </button>
</div>
  </div>
) : null}

{progressState ? (
  <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
    <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
      IN PROGRESS
    </div>

    <div className="mt-2 text-lg font-semibold text-white">
      {progressState.title}
    </div>

    <div className="mt-1 text-sm text-white/75">
      {progressState.description}
    </div>

    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
  <div
    className="h-2 rounded-full bg-cyan-400 transition-all duration-700 ease-out"
    style={{ width: `${progressPercent}%` }}
  />
</div>

<style jsx>{`
  @keyframes progressSlide {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(120%);
    }
    100% {
      transform: translateX(320%);
    }
  }
`}</style>

    <div className="mt-4 grid gap-2">
      {progressState.steps.map((step, index) => {
  const animatedActiveStep =
    progressState.steps.length > 0
      ? progressTick % progressState.steps.length
      : progressState.activeStep;

  const isActive = index === animatedActiveStep;
  const isDone = false;

        return (
          <div
            key={step}
            className={[
              "rounded-xl px-3 py-2 text-sm",
              isActive
                ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                : isDone
                ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border border-white/10 bg-white/5 text-white/60",
            ].join(" ")}
          >
            {isDone ? "✓" : isActive ? "•" : "○"} {step}
          </div>
        );
      })}
    </div>
  </div>
) : null}
        </div>
      </section>

{hasRunDiagnosticThisSession && displayDetectedSignals ? (
  <section className="mt-6 rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.45)] p-5">
    <div className="text-xs font-semibold tracking-widest text-white/70">
      DETECTED SIGNALS
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {displayDetectedSignals.likelyCategory ? (
  <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-200">
    {formatCategoryLabel(displayDetectedSignals.likelyCategory, selectedGameKey)}
  </span>
) : null}

      {displayDetectedSignals.loader ? (
  <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-200">
    {getLoaderLabelForGame(selectedGameKey)}: {formatLoaderLabel(displayDetectedSignals.loader)}
  </span>
) : null}

      {displayDetectedSignals.gameVersion ? (
        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
          {getVersionLabelForGame(selectedGameKey)} {displayDetectedSignals.gameVersion}
        </span>
      ) : null}

      {displayDetectedSignals.javaVersion && getJavaLabelForGame(selectedGameKey) ? (
  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
    {getJavaLabelForGame(selectedGameKey)} {displayDetectedSignals.javaVersion}
  </span>
) : null}

      {displayDetectedSignals.errorType ? (
        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-200">
          {displayDetectedSignals.errorType}
        </span>
      ) : null}

      {displayDetectedSignals.suspectedMods?.map((mod) => (
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

{actionMsg && actionMsgLocation === "smartFix" ? (
  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-100">
    {actionMsg}
  </div>
) : null}

{hasRunDiagnosticThisSession && displayAnalysis ? (
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
    {displayAnalysis ? (
  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
    <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
      QUICK ACTIONS
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
  {selectedGameProfile.supportsModsFolder ? (
    <button
      type="button"
      onClick={() => {
  openModsFolder(false, "quickActions");
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
  openLogsFolder(false, "quickActions");
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
  displayDetectedSignals?.suspectedMods?.length
    ? displayDetectedSignals.suspectedMods.join(", ")
    : liveMods.length
    ? liveMods.join(", ")
    : "No suspected mods detected.";

      addToFixHistory("suspected_mods", `${gameTitle} suspected mods`, modsText);

      try {
        await copyTextReliable(modsText);
        setCopied(true);
        showActionMessage("Suspected mods copied and saved to Fix History.", "smartFix");
setTimeout(() => {
  setCopied(false);
}, 4000);
      } catch (error: unknown) {
        setCopied(false);
        showActionMessage("Suspected mods saved to Fix History. System clipboard copy failed on this device.", "smartFix");

        setErrorMsg(
          error instanceof Error ? error.message : "Failed to copy suspected mods."
        );
      }
    }}
    className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
  >
    {copied ? "Copied!" : "Copy Suspected Mods"}
  </button>

  <button
    type="button"
    onClick={() => runDiagnostic()}
    disabled={!canRun || running}
    className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {running ? "Running..." : "Run Again"}
  </button>
</div>
  </div>
) : null}
{quickActionFolderError ? (
  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-100">
    {quickActionFolderError}
  </div>
) : null}
  </section>
) : null}

<section ref={diagnosticResultRef} className="mt-6">
  {hasRunDiagnosticThisSession && displayAnalysis ? (
    <div className="rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.55)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold tracking-widest text-white/70">
          DIAGNOSTIC RESULT
        </div>

<div className="flex items-center gap-2">
<button
  type="button"
  onClick={() => {
    if (!isPro && !isBetaAccess) {
      setProModalContext("saveAnalysis");
      setShowProModal(true);
      return;
    }

    saveResult();
  }}
  className={[
    "rounded-lg px-3 py-1.5 text-sm transition",
    isPro || isBetaAccess
      ? "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
      : "border border-amber-400/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15",
  ].join(" ")}
>
    {isPro || isBetaAccess ? (saved ? "Saved!" : "Save Results") : "Save Export (Pro)"}
</button>

  <button
    type="button"
    onClick={copyResult}
    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
  >
    {copied ? "Copied!" : "Copy Results"}
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
  {displayAnalysis.quickFixFirst}
</div>
        </div>

        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
    FIX ASSISTANT
  </div>

  <div className="mt-3 flex flex-wrap gap-2">
    <button
      type="button"
      onClick={applyQuickFix}
      disabled={!hasDiagnosticResult}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      ⚡ Copy Recommended Fix
    </button>

    <button
  type="button"
  onClick={() => {
    setCurrentGuideStep(0);
    setCompletedGuideSteps([]);
    openStepByStepGuide();
  }}
  disabled={!hasDiagnosticResult}
  className="rounded-xl bg-black/20 px-4 py-3 text-left text-white transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
>
  🧭 View Step-by-Step Guide
</button>

    <button
      type="button"
      onClick={() => {
        if (!fixPlan) {
          setErrorMsg("Run a diagnostic first.");
          return;
        }
        setFixPreviewError("");
        setShowFixPreviewModal(true);
      }}
      disabled={!hasDiagnosticResult || !fixPlan}
      className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      🛠️ Safe Repair
    </button>
  </div>
</div>
{shouldShowMissingModRecovery ? (
  <section className="mt-3 rounded-3xl border border-white/10 bg-[#071224] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
      Missing Mod Recovery
    </div>

    <h3 className="mt-3 text-2xl font-bold text-white">
      Recover or reinstall {missingModRecoveryTarget}
    </h3>

    <p className="mt-2 text-sm text-white/70">
      FixMyGame can look for this mod on your device. If it finds the mod in the wrong place,
      it can move it back into your game’s Mods folder. If it is not found locally, you can open
      the download page directly.
    </p>

    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={searchForMissingModOnDevice}
        disabled={searchingMissingMod}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {searchingMissingMod ? "Searching This PC..." : "Search This PC"}
      </button>

      <button
        type="button"
        onClick={moveFoundModIntoModsFolder}
        disabled={!missingModRecovery?.found || movingMissingMod}
        className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {movingMissingMod ? "Moving Mod..." : "Move to Mods Folder"}
      </button>

      <button
        type="button"
        onClick={openMissingModDownloadPage}
        disabled={!missingModDownloadUrl}
        className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Download Missing Mod
      </button>
    </div>

    <div className="mt-5 grid gap-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Missing Mod
        </div>
        <div className="mt-2 text-white">{primaryMissingModName}</div>
      </div>

      {missingModRecovery ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            Search Result
          </div>

                    {missingModRecovery.found ? (
            <div className="mt-3 space-y-3 text-sm text-white/80">
              <div>
                <div className="text-white/50">Found at</div>
                <div className="break-all text-white">{missingModRecovery.foundPath}</div>
              </div>

              <div>
                <div className="text-white/50">Needed in</div>
                <div className="break-all text-white">{missingModRecovery.expectedPath}</div>
              </div>

{missingModRecovery.justMovedToCorrectPlace ? (
  <div className="text-emerald-300">
    This mod was successfully moved back into the correct Mods folder.
  </div>
) : missingModRecovery.alreadyInCorrectPlace ? (
  <div className="text-emerald-300">
    This mod is already in the correct Mods folder. This log may be old, or the mod was restored after the log was created. Launch the game again and run a fresh diagnostic if the issue continues.
  </div>
) : missingModRecovery.foundCandidateKind === "archive_file" ? (
  <div className="text-amber-300">
    A downloaded archive for this mod was found. It still needs to be extracted or installed into the Mods folder.
  </div>
) : (
  <div className="text-cyan-200">
    This mod was found outside the Mods folder and can be moved back automatically.
  </div>
)}
            </div>
          ) : (
            <div className="mt-3 text-sm text-white/75">
              This mod was not found in the common local locations FixMyGame searched.
              Use the download button to reinstall it.
            </div>
          )}
        </div>
      ) : null}

      {missingModDownloadUrl ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            Download Source
          </div>
          <div className="mt-2 break-all text-sm text-cyan-200">
            {missingModDownloadUrl}
          </div>
        </div>
      ) : null}
    </div>
  </section>
) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold tracking-widest text-white/60">
              ISSUE
            </div>
            <div className="mt-2 text-white">{displayAnalysis.issue}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold tracking-widest text-white/60">
              CONFIDENCE
            </div>
<div
  className={[
    "mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
    displayAnalysis.confidenceLevel === "High"
      ? "bg-green-500/20 text-green-300"
      : displayAnalysis.confidenceLevel === "Medium"
      ? "bg-yellow-500/20 text-yellow-300"
      : "bg-red-500/20 text-red-300",
  ].join(" ")}
>
  {displayAnalysis.confidenceLevel}
</div>          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold tracking-widest text-white/60">
            PROBABILITY BREAKDOWN
          </div>
          <ul className="mt-3 grid gap-2 text-white/90">
            {displayAnalysis.probabilityBreakdown.map((item, index) => {
  const formatted = formatProbabilityItem(item, index);

  return (
    <li key={`${index}-${item}`} className="rounded-xl bg-white/5 px-3 py-2">
      <div className="flex justify-between text-sm">
        <span>{formatted.label}</span>
      </div>

      <div className="mt-2 h-2 w-full rounded bg-white/10 overflow-hidden">
        <div
          className="h-2 rounded bg-blue-500 transition-all"
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
          <div className="mt-2 text-white">{displayAnalysis.mostLikelyCause}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold tracking-widest text-white/60">
            RECOMMENDED FIX STEPS
          </div>
          <ol className="mt-3 grid gap-2 text-white/90">
            {displayAnalysis.recommendedFixSteps.map((step, index) => (
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
          <div className="mt-2 text-white/90">{displayAnalysis.needMoreInfo}</div>
        </div>

        <details className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <summary className="cursor-pointer text-xs font-semibold tracking-widest text-white/60">
            RAW TEXT VERSION
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-sm leading-relaxed max-h-[300px] overflow-y-auto">
            {result}
          </pre>
        </details>
        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
    CONTINUE FROM THIS RESULT
  </div>

    {showDiagnosticRefineBox ? (
    <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        REFINE NEXT DIAGNOSTIC
      </div>

      <div className="mt-2 text-sm text-white/75">
        {diagnosticRefineMode === "still_crashing"
          ? "Tell FixMyGame what is still wrong or what it missed."
          : "Add anything you want FixMyGame to keep in mind for the next diagnostic."}
      </div>

<div className="mt-2 text-xs text-white/55">
  You can run the next diagnostic with your note only, or add a newer crash log below if you want FixMyGame to compare new evidence.
</div>

      <textarea
        value={diagnosticRefineText}
        onChange={(e) => setDiagnosticRefineText(e.target.value)}
        placeholder={
          diagnosticRefineMode === "still_crashing"
            ? "Example: The game launches now, but one mod still does not load and I still see a workshop mismatch warning."
            : "Example: I removed the suspected mod, but I still want FixMyGame to watch for dependency warnings."
        }
        className="mt-3 min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/30"
      />

<div className="mt-3">
  {!showAdditionalRefineLogBox ? (
    <button
      type="button"
      onClick={() => setShowAdditionalRefineLogBox(true)}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      Add Additional Crash Log
    </button>
  ) : (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs font-semibold tracking-widest text-white/60">
        ADDITIONAL CRASH LOG
      </div>

      <div className="mt-2 text-xs text-white/55">
        Paste a newer or more relevant crash/error log here if you have one.
      </div>

      <textarea
        value={additionalRefineLog}
        onChange={(e) => setAdditionalRefineLog(e.target.value)}
        placeholder="Paste a newer crash log, warning output, or relevant error snippet here..."
        className="mt-3 min-h-[140px] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/30"
      />

      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            setShowAdditionalRefineLogBox(false);
            setAdditionalRefineLog("");
          }}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Remove Additional Log
        </button>
      </div>
    </div>
  )}
</div>

     <div className="mt-3 flex flex-wrap gap-2">

  <button
  type="button"
  onClick={async () => {
    if (!diagnosticRefineMode) return;
    await runRefinedDiagnosticNow();
  }}
  className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15"
>
  Run Refined Diagnostic
</button>

  <button
    type="button"
    onClick={() => {
      setShowDiagnosticRefineBox(false);
      setDiagnosticRefineMode(null);
      setDiagnosticRefineText("");
      setShowAdditionalRefineLogBox(false);
      setAdditionalRefineLog("");
    }}
    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
  >
    Cancel
  </button>
</div>
    </div>
) : (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={async () => {
  pushSupportEvent("continue_diagnostic_clicked", "User clicked Continue Diagnostic");
  await sendSupportSnapshot(
    "continue_diagnostic_clicked",
    "User clicked Continue Diagnostic"
  );
  startResultRefinement("continue");
}}
        className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/15"
      >
        Continue Diagnostic
      </button>

      <button
  type="button"
  onClick={async () => {
  pushSupportEvent("diagnostic_fixed_it_clicked", "User marked current issue as fixed");
  await sendSupportSnapshot(
    "diagnostic_fixed_it_clicked",
    "User marked current issue as fixed"
  );
  showResultFollowupMessage(
    "Nice — current issue marked as fixed.",
    "success"
  );
}}
  className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15"
>
  ✅ Fixed it
</button>

      <button
        type="button"
        onClick={async () => {
  pushSupportEvent("still_crashing_clicked", "User clicked Still Crashing");
  await sendSupportSnapshot(
    "still_crashing_clicked",
    "User clicked Still Crashing"
  );
  startResultRefinement("still_crashing");
}}
        className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/15"
      >
        ❌ Still crashing
      </button>
    </div>
  )}
</div>

  <p className="mt-2 text-sm text-white/70">
    If you test a fix and want FixMyGame to stay aware of this issue on your next diagnostic,
    continue from this result before loading a newer crash log.
  </p>
</div>
  </div>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.35)] p-5 text-white/70">
  Paste a {gameTitle} crash log or error report, then run a diagnostic to see results here.
</div>
  )}
</section>

{showSettingsModal ? (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    onClick={() => setShowSettingsModal(false)}
  >
    <div
      className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#071224] p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
            SETTINGS
          </div>
          <h2 className="mt-2 text-2xl font-bold text-white">
            FixMyGame Settings
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Control privacy, diagnostics, and local app preferences.
            <div className="mt-2 text-sm text-white/50">
              Changes are saved automatically on this device.
            </div>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSettingsModal(false)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setSettingsTab("privacy")}
          className={[
            "rounded-xl px-4 py-2 text-sm font-medium transition",
            settingsTab === "privacy"
              ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
              : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
          ].join(" ")}
        >
          Privacy
        </button>

        <button
          type="button"
          onClick={() => setSettingsTab("app")}
          className={[
            "rounded-xl px-4 py-2 text-sm font-medium transition",
            settingsTab === "app"
              ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
              : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
          ].join(" ")}
        >
          App
        </button>
      </div>

     {settingsTab === "privacy" ? (
  <div className="mt-5 grid gap-4">
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        PRIVACY & DIAGNOSTICS
      </div>

      <div className="mt-4">
        <div className="font-medium text-white">
          Help improve FixMyGame by sharing anonymous diagnostic data
        </div>

        <p className="mt-2 text-sm text-white/60">
          Includes crash patterns, detected issues, and fix results. No unrelated personal files are collected.
        </p>

        <p className="mt-2 text-xs text-white/45">
          Current status: {supportTelemetryEnabled ? "On" : "Off"}
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
            YOUR DATA
          </div>

          <div className="mt-3 text-sm text-white/70">
            We never collect:
          </div>

          <ul className="mt-2 list-disc pl-5 text-sm text-white/60 space-y-1">
            <li>Personal files or documents</li>
            <li>Passwords or account information</li>
            <li>Full folder contents</li>
            <li>Payment or financial data</li>
            <li>Anything unrelated to crash diagnostics</li>
          </ul>
        </div>

        <div className="mt-5 flex justify-end">
          <label className="relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={supportTelemetryEnabled}
              onChange={toggleSupportTelemetry}
              className="peer sr-only"
              aria-label="Share anonymous diagnostic data"
            />
            <span className="absolute inset-0 rounded-full bg-white/15 transition peer-checked:bg-cyan-400" />
            <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition peer-checked:left-8" />
          </label>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-4">
      <div className="font-medium text-white">Reset privacy consent</div>

      <p className="mt-2 text-sm text-white/60">
        This will clear your accepted authorization and reopen the privacy consent screen next time.
      </p>

      <button
        type="button"
        onClick={() => {
          const confirmed = window.confirm(
            "Reset privacy consent? You will see the authorization screen again next time."
          );

          if (!confirmed) return;

          window.localStorage.removeItem(APP_AUTH_STORAGE_KEY);
          window.localStorage.removeItem(SUPPORT_TELEMETRY_STORAGE_KEY);

          setHasAcceptedAuthorization(false);
          setSupportTelemetryEnabled(false);
          setShowSettingsModal(false);
        }}
        className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
      >
        Reset Consent
      </button>
    </div>
  </div>
) : (
        <div className="mt-5 grid gap-4">
  <SettingsPanel title="FIX ASSISTANT">
  <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50/85">
    FixMyGame automatically creates a backup before applying safe fixes.
  </div>

  <SettingToggleRow
  label="Enable Safe Repair"
  description="Allow FixMyGame to suggest safe repair actions, like backing up and temporarily disabling likely problem mods."
  checked={appSettings.enableSafeFix}
  onChange={(checked) =>
    setAppSettings((prev) => ({ ...prev, enableSafeFix: checked }))
  }
/>

  <SettingToggleRow
    label="Confirm Before Applying Fix"
    description="Always review changes before any fix is applied."
    checked={appSettings.askBeforeFixing}
    onChange={(checked) =>
      setAppSettings((prev) => ({ ...prev, askBeforeFixing: checked }))
    }
  />
</SettingsPanel>

  <SettingsPanel title="DIAGNOSTIC DISPLAY">
    <SettingToggleRow
      label="Show Advanced Details"
      description="Show detected signals, loader, version, and technical tags."
      checked={appSettings.showAdvancedDetails}
      onChange={(checked) =>
        setAppSettings((prev) => ({ ...prev, showAdvancedDetails: checked }))
      }
    />

    <SettingToggleRow
      label="Highlight Suspicious Line"
      description="Show the log line FixMyGame thinks matters most."
      checked={appSettings.highlightSuspiciousLine}
      onChange={(checked) =>
        setAppSettings((prev) => ({
          ...prev,
          highlightSuspiciousLine: checked,
        }))
      }
    />

    <SettingToggleRow
      label="Show Probability Breakdown"
      description="Show why FixMyGame picked the likely cause."
      checked={appSettings.showProbabilityBreakdown}
      onChange={(checked) =>
        setAppSettings((prev) => ({
          ...prev,
          showProbabilityBreakdown: checked,
        }))
      }
    />
  </SettingsPanel>

  <SettingsPanel title="HISTORY & LOCAL DATA">
    <SettingToggleRow
      label="Save Fix History"
      description="Save diagnostics and copied fixes on this device."
      checked={appSettings.saveFixHistory}
      onChange={(checked) =>
        setAppSettings((prev) => ({ ...prev, saveFixHistory: checked }))
      }
    />

    <button
      type="button"
      onClick={resetSavedSystemPrefs}
      className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-left font-semibold text-red-100 transition hover:bg-red-400/20"
    >
      Reset Device Data
    </button>

    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
      This resets saved game, GPU, driver version, and graphics API preferences on this device.
    </div>
  </SettingsPanel>
</div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShowSettingsModal(false)}
          className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Done
        </button>
      </div>
    </div>
  </div>
) : null}

{showFixGuide && displayAnalysis ? (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    onClick={() => setShowFixGuide(false)}
  >
    <div
      className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071224] shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b border-white/10 p-6">
        <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
          INTERACTIVE FIX GUIDE
        </div>

        <h2 className="mt-2 text-2xl font-bold text-white">
          {gameTitle} Fix Walkthrough
        </h2>

        <p className="mt-3 text-white/70">
          Complete one step at a time. Test the game after each major change.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
          <div className="text-xs font-semibold tracking-widest text-yellow-200/80">
            START HERE
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {displayAnalysis.quickFixFirst}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {displayAnalysis.recommendedFixSteps.map((step, index) => {
            const isCurrent = index === currentGuideStep;
            const isDone = completedGuideSteps.includes(index);

            return (
              <button
                key={`${index}-${step}`}
                type="button"
                onClick={() => setCurrentGuideStep(index)}
                className={[
                  "rounded-xl border px-4 py-4 text-left transition",
                  isCurrent
                    ? "border-cyan-300/40 bg-cyan-400/10"
                    : isDone
                    ? "border-emerald-300/30 bg-emerald-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold tracking-widest text-white/50">
                    STEP {index + 1}
                  </div>

                  <div className="text-sm">
                    {isDone ? "✅ Done" : isCurrent ? "➡️ Current" : "○"}
                  </div>
                </div>

                <div className="mt-2 text-white/90">{step}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold tracking-widest text-white/60">
            MOST LIKELY CAUSE
          </div>
          <div className="mt-2 text-white">
            {displayAnalysis.mostLikelyCause}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
  <div className="mb-3 text-sm text-white/60">
    Step {Math.min(currentGuideStep + 1, displayAnalysis.recommendedFixSteps.length)} of{" "}
    {displayAnalysis.recommendedFixSteps.length}
  </div>

  <div className="flex flex-wrap justify-between gap-3">
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => setShowFixGuide(false)}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Close
      </button>

      <button
        type="button"
        onClick={() => {
          setCurrentGuideStep((prev) => Math.max(prev - 1, 0));
        }}
        disabled={currentGuideStep === 0}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Back
      </button>
    </div>

    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={applyQuickFix}
        className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
      >
        Copy Steps
      </button>

      <button
        type="button"
        onClick={() => {
          setCompletedGuideSteps((prev) => {
            if (prev.includes(currentGuideStep)) {
              return prev.filter((stepIndex) => stepIndex !== currentGuideStep);
            }

            return [...prev, currentGuideStep];
          });
        }}
        className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
      >
        Undo / Mark Done
      </button>

      <button
        type="button"
        onClick={() => {
          setCompletedGuideSteps((prev) => {
            if (prev.includes(currentGuideStep)) return prev;
            return [...prev, currentGuideStep];
          });

          setCurrentGuideStep((prev) =>
            Math.min(prev + 1, displayAnalysis.recommendedFixSteps.length - 1)
          );
        }}
        className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300"
      >
        Done & Next →
      </button>
    </div>
  </div>
</div>
    </div>
  </div>
) : null}
{showFixPreviewModal && fixPlan ? (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    onClick={() => {
      if (!runningFixPlan) setShowFixPreviewModal(false);
    }}
  >
   <div
  className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071224] shadow-2xl"
  onClick={(e) => e.stopPropagation()}
>
      <div className="shrink-0 border-b border-white/10 px-6 py-5">
  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
    REPAIR PREVIEW
  </div>

  <h2 className="mt-2 text-2xl font-bold text-white">
    {fixPlan.title}
  </h2>

  <p className="mt-3 text-white/75">
    {fixPlan.description}
  </p>
</div>

<div className="custom-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
  {activeSafeFixCategory === "missing_dependency" ? (
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        NEXT STEP
      </div>
      <div className="mt-2 text-lg font-semibold text-white">
        Download the missing mod.
      </div>
      <div className="mt-2 text-sm text-white/70">
        FixMyGame will open the download page. Nothing will be moved or quarantined.
      </div>
    </div>
  ) : activeSafeFixCategory === "mod_conflict" ? (
    <>
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
        <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
          SAFE FIX
        </div>
        <div className="mt-2 text-lg font-semibold text-white">
          Back up and quarantine the likely problem mod.
        </div>
        <div className="mt-2 text-sm text-white/70">
          FixMyGame will move the matched mod out of your active Mods folder so the game can test without it.
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold tracking-widest text-white/60">
          BEFORE YOU CONTINUE
        </div>

        <div className="mt-3 grid gap-2">
          {buildSafeFixPlanPreview({
            suspectMods: safeFixSuspects,
            selectedGameKey,
          }).map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
            >
              <div className="font-medium text-white">{item.title}</div>
              <div className="mt-1 text-sm text-white/65">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  ) : (
    <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
      <div className="text-xs font-semibold tracking-widest text-yellow-200/80">
        MANUAL FIX
      </div>
      <div className="mt-2 text-lg font-semibold text-white">
        Follow the recommended steps.
      </div>
      <div className="mt-2 text-sm text-white/70">
        Automatic repair is not available for this result.
      </div>
    </div>
  )}

  {!gameInstallPath && activeSafeFixCategory === "mod_conflict" ? (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
      Safe Fix needs a detected local {gameTitle} install.
    </div>
  ) : activeSafeFixCategory === "mod_conflict" && safeFixSuspects.length === 0 ? (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
      No suspected mod was detected for Safe Fix.
    </div>
  ) : null}

  {fixPreviewError ? (
    <div className="mt-5 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
      {fixPreviewError}
    </div>
  ) : null}
</div>

<div className="shrink-0 border-t border-white/10 px-6 py-4">
  <div className="flex flex-wrap justify-end gap-3">

    <button
      type="button"
      onClick={() => setShowFixPreviewModal(false)}
      disabled={runningFixPlan}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      Cancel
    </button>

    <button
      type="button"
      onClick={applyQuickFix}
      disabled={runningFixPlan}
      className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Copy Fix Steps
    </button>

<button
  type="button"
  onClick={() => {
    if (activeSafeFixCategory === "missing_dependency") {
      if (missingModAlreadyInstalled) {
        openModsFolder(false, "quickActions");
        return;
      }

      openMissingModDownloadPage();
      return;
    }

    applySafeFixNow();
  }}
  disabled={
    applyingSafeFix ||
    (activeSafeFixCategory === "missing_dependency"
      ? !missingModAlreadyInstalled && !missingModDownloadUrl
      : !canApplySafeFix)
  }
  className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
>
  {activeSafeFixCategory === "missing_dependency"
    ? missingModAlreadyInstalled
      ? "Open Mods Folder"
      : missingModDownloadUrl
      ? "Download Missing Mod"
      : "Download Link Not Found"
      : applyingSafeFix
? "Applying Safe Repair..."
: !appSettings.enableSafeFix
? "Safe Repair Disabled in Settings"
: !gameInstallPath
? "Safe Repair Needs Local Game Install"
: activeSafeFixCategory !== "mod_conflict"
? "Safe Repair Not Available for This Result"
: safeFixSuspects.length === 0
? "Safe Repair Needs a Suspected Mod"
: "Apply Safe Repair"}
</button>

    <button
      type="button"
      onClick={runFixPlan}
      disabled={runningFixPlan}
      className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {runningFixPlan ? "Opening Tools and Copying Steps..." : "Guide Me Through It"}
    </button>
  </div>
</div>
    </div>
  </div>
) : null}

{showFixFeedback ? (
  <div className="fixed bottom-6 right-6 z-50 w-[340px] rounded-2xl border border-white/10 bg-[#071224] p-5 shadow-2xl">
    <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
      FIX RESULT
    </div>

    <div className="mt-2 text-white font-semibold">
      Did this fix your issue?
    </div>

<div className="mt-2 text-sm text-white/70">
  {lastFixResult?.movedFile
    ? lastFixResult?.candidateKind === "empty_folder"
      ? `We backed up and quarantined the empty folder ${lastFixResult.movedFile} so the game no longer loads it.`
      : lastFixResult?.candidateKind === "invalid_loose_file"
      ? `We backed up and quarantined the loose file ${lastFixResult.movedFile} so it no longer interferes with loading.`
      : `We backed up and quarantined ${lastFixResult.movedFile} so the game no longer loads it.`
    : "We applied a safe fix to your game."}
</div>

    <div className="mt-4 flex gap-2">
      <button
        onClick={async () => {
  setShowFixFeedback(false);
  pushSupportEvent("fix_confirmed", "User said the fix worked");
  await sendSupportSnapshot("fix_confirmed", "User said the fix worked");
  showActionMessage(
    "Nice — your game should be working now. You’re good to go.",
    "fixAssistant"
  );
}}
        className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 font-medium text-black hover:bg-emerald-400"
      >
        ✅ Fixed it
      </button>

      <button
  onClick={async () => {
  setShowFixFeedback(false);
  pushSupportEvent("still_crashing_after_fix", "User said the issue is still happening after safe fix");
  await sendSupportSnapshot(
    "still_crashing_after_fix",
    "User said the issue is still happening after safe fix"
  );

  setTimeout(() => {
    const el = document.getElementById("run-diagnostic-button");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 300);
}}
  className="flex-1 rounded-xl bg-red-500/20 px-3 py-2 font-medium text-red-200 hover:bg-red-500/30"
>
  ❌ Still crashing
</button>
    </div>
  </div>
): null}

{showFixHistoryModal ? (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    onClick={() => setShowFixHistoryModal(false)}
  >
    <div
      className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#071224] p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
            FIX HISTORY
          </div>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Saved Items and Diagnostics
          </h2>

          <p className="mt-2 text-white/75">
            This history stays on this device and saves fixes, results, and copied text from FixMyGame so you can come back to them later.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFixHistoryModal(false)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Close
        </button>
      </div>

<div className="mt-4 flex gap-2">
  <button
    type="button"
    onClick={() => setFixHistoryTab("saved")}
    className={[
      "rounded-xl px-4 py-2 text-sm font-medium transition",
      fixHistoryTab === "saved"
        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
        : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
    ].join(" ")}
  >
    Saved ({savedHistoryItems.length})
  </button>

  <button
    type="button"
    onClick={() => setFixHistoryTab("diagnostics")}
    className={[
      "rounded-xl px-4 py-2 text-sm font-medium transition",
      fixHistoryTab === "diagnostics"
        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
        : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
    ].join(" ")}
  >
    Diagnostics ({diagnosticHistoryItems.length})
  </button>
</div>

      <div className="mt-1 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={clearFixHistory}
          disabled={visibleHistoryItems.length === 0}
          className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear All
        </button>
      </div>

      <div className="mt-5 max-h-[460px] space-y-3 overflow-y-auto pr-1">
        {visibleHistoryItems.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
            {fixHistoryTab === "saved"
            ? "No saved items yet. Copy a quick fix, result, suspected mods, or fix plan to save it here."
            : "No diagnostic runs yet. Run a diagnostic and FixMyGame will save it here automatically."}
          </div>
        ) : (
          visibleHistoryItems.map((item) => (
            <div
  key={item.id}
  className={[
    "rounded-xl border p-4",
    item.type === "diagnostic_run"
      ? "border-white/8 bg-white/[0.03]"
      : "border-white/10 bg-white/5",
  ].join(" ")}
>
<div className="flex flex-wrap items-center justify-between gap-3">
  <div>
    <div className="font-semibold text-white">{item.title}</div>
    <div className="mt-1 text-xs text-white/50">
      {item.gameTitle} • {new Date(item.createdAt).toLocaleString()}
    </div>
  </div>

  <div className="flex flex-wrap gap-2">
    {item.type === "diagnostic_run" ? (
      <button
        type="button"
        onClick={() => {
          setContinuedDiagnosticBase(item);
          setShowFixHistoryModal(false);
          showActionMessage(
            `Continuing from ${item.gameTitle}. Load a newer crash log, then run another diagnostic.`,
            "diagnostic"
          );
        }}
        className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-400/15"
      >
        Continue From Here
      </button>
    ) : null}

    <button
      type="button"
      onClick={async () => {
        try {
          await copyTextReliable(item.text);
          showActionMessage("History item copied to system clipboard.", "fixAssistant");
        } catch (error: unknown) {
          showActionMessage(
            "System clipboard copy failed on this device, but the item remains saved in Fix History.",
            "fixAssistant"
          );

          setErrorMsg(
            error instanceof Error ? error.message : "Failed to copy Fix History item."
          );
        }
      }}
      className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-400/15"
    >
      Copy
    </button>

    <button
      type="button"
      onClick={() => deleteFixHistoryItem(item.id)}
      className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-500/15"
    >
      Delete
    </button>
  </div>
</div>

              <pre className="mt-3 max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-sm text-white/85">
                {item.text}
              </pre>
            </div>
          ))
        )}
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
{!checkingAuthorization && !hasAcceptedAuthorization ? (
  <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-6">
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#071224] shadow-2xl">
      <div className="max-h-[85vh] overflow-y-auto p-6 pr-4">
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        BEFORE YOU CONTINUE
      </div>

      <h2 className="mt-2 text-3xl font-bold text-white">
        FixMyGame needs your approval
      </h2>

      <p className="mt-4 text-white/80">
        FixMyGame scans game-related files, reads logs, and can perform supported repair actions after you approve them.
      </p>

      <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
        <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
          WHAT FIXMYGAME MAY DO
        </div>

        <ul className="mt-3 grid gap-2 text-sm text-white/90">
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Scan game, mod, and log folders related to diagnostics
          </li>
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Read log files to identify likely crashes, conflicts, and missing dependencies
          </li>
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Open game-related folders you request
          </li>
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Make supported repair changes only after you confirm them
          </li>
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Create backups before supported file-changing fixes
          </li>
        </ul>
      </div>

<div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
  <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
    HELP IMPROVE FIXMYGAME
  </div>

  <div className="mt-3 text-sm text-white/90">
    If enabled, FixMyGame can securely collect anonymous diagnostic snapshots such as crash logs, mod lists, system details, detected issues, and repair actions. This helps improve detection accuracy, identify common problems faster, and deliver better fixes in future updates.
  </div>

  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-4 transition hover:bg-black/30">
    <input
  type="checkbox"
  checked={supportTelemetryEnabled}
  onChange={(e) => {
    setSupportTelemetryEnabled(e.target.checked);
    if (e.target.checked) setShowError(false);
  }}
  className="mt-1 h-4 w-4 accent-cyan-400"
/>
    <div>
      <div className="text-sm font-medium text-white">
        Help improve FixMyGame by sharing anonymous diagnostic data (recommended)
      </div>
      <div className="mt-1 text-xs text-white/60">
        This helps improve issue detection, repair quality, and future updates. No unrelated personal files are accessed.
      </div>
    </div>
  </label>
  {showError ? (
  <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">
    Please check the box before continuing.
  </div>
) : null}
</div>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold tracking-widest text-white/60">
          WHAT FIXMYGAME WILL NOT DO AUTOMATICALLY
        </div>

        <ul className="mt-3 grid gap-2 text-sm text-white/85">
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Delete files without your confirmation
          </li>
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Make silent repair changes in the background
          </li>
          <li className="rounded-lg bg-black/20 px-3 py-2">
            Access unrelated personal files outside supported diagnostic workflows
          </li>
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={exitAuthorizationGate}
          className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-red-200 transition hover:bg-red-500/15"
        >
          Exit
        </button>

        <button
          type="button"
          onClick={acceptAuthorizationGate}
          className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-black transition hover:bg-cyan-400"
        >
          Continue
        </button>
      </div>
    </div>
        </div>
    </div>
) : null}
<div className="mt-8 flex justify-end">
  <button
    type="button"
    onClick={openSupportEmail}
    className="text-xs text-white/50 hover:text-white"
  >
    Report an Issue
  </button>
</div>
    </main>
  );
}

function DarkSelect(props: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  const filteredOptions = props.options.filter((option) =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (open) {
            setSearch("");
          }
        }}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-left text-white outline-none transition hover:border-white/20"
      >
        <span>{props.value}</span>
        <span className="text-white/60">{open ? "▴" : "▾"}</span>
      </button>

      {open ? (
        <div className="custom-scroll absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl ring-1 ring-black/40">
          <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1220] p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to find a game..."
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/20"
            />
          </div>

          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const active = option === props.value;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    props.onChange(option);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={[
                    "block w-full px-4 py-2.5 text-left transition",
                    option === "Custom / Other" ? "border-t border-white/10 mt-1 pt-3" : "",
                    index === filteredOptions.length - 1 ? "rounded-b-xl" : "",
                    active
                      ? "bg-blue-400/15 text-white"
                      : "text-white/85 hover:bg-white/5",
                  ].join(" ")}
                >
                  {option}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-sm text-white/50">
              No matching games found.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SettingsPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        {title}
      </div>

      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function SettingToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div>
        <div className="font-medium text-white/90">{label}</div>
        <div className="mt-1 text-sm text-white/55">{description}</div>
      </div>

      <div className="mt-5 flex justify-end">
  <label className="relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
          aria-label={label}
        />
        <span className="absolute inset-0 rounded-full bg-white/15 transition peer-checked:bg-cyan-400" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition peer-checked:left-8" />
      </label>
    </div>
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
    <div className="flex flex-col gap-1 mt-4">
      <div className="flex items-center gap-3">
        <div className="text-xs font-semibold tracking-widest text-white/70 mb-1">
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