"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { recordEmergencyEvent } from "@/lib/recordEmergencyEvent";

declare global {
  interface Window {
    fixMyGame?: {
      ping?: () => string;
      scanLogsForGame?: (gameKey: string) =>
        | Promise<
            {
              name: string;
              fullPath: string;
              lastModified?: number;
              size?: number;
            }[]
          >
        | {
            name: string;
            fullPath: string;
            lastModified?: number;
            size?: number;
          }[];
      pickLogFile?: () => Promise<string | null>;
      pickScanFolder?: (defaultPath?: string) => Promise<string | null>;
      scanCustomFolder?: (
        folderPath: string,
        gameKey?: string,
      ) => Promise<
        {
          name: string;
          fullPath: string;
          lastModified?: number;
          size?: number;
        }[]
      >;
      readLogFile?: (filePath: string) => Promise<string>;
      saveAnalysis?: (
        defaultPath: string,
        content: string,
      ) => Promise<{
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
        candidateKind?:
          | "empty_folder"
          | "invalid_loose_file"
          | "mod_file"
          | "mod_folder";
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

    explanation?: {
      whatThisMeans: string;
      whyFixMyGameThinksThis: string[];
      beginnerExplanation: string;
      doNotDoYet: string[];
      stillCrashingNextSteps: string[];
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

type RepairTimelineItem = {
  id: string;
  time: number;
  title: string;
  detail: string;
  status: "info" | "success" | "warning" | "failed";
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

const FIXMYGAME_APP_VERSION = "1.0.9-beta.1";
const FIXMYGAME_BUILD_CHANNEL = "beta";
const FIXMYGAME_BETA_INVITE_URL = "https://fixmygame-site.vercel.app/";
const FIXMYGAME_BETA_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScGcdRTg2kv4-_NKk1x2MkjSd1QsVItjKxi0ht--HNf1GLngQ/viewform"
const FIXMYGAME_DISCORD_URL = "https://discord.gg/MfcAX69EU";
const FIXMYGAME_FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/1TM1lghcLiq95Hq37vUB67--FCAmfSByB9KZL1_UZJf4/edit";
const FIXMYGAME_DONATION_URL = "https://ko-fi.com/fixmygame";
const WHATS_NEW_STORAGE_KEY = `fixmygame:whats-new-seen:${FIXMYGAME_APP_VERSION}`;

const BETA_ACCESS_STORAGE_KEY = "fixmygame:beta-access";

type BetaAccessState = {
  betaId: string;
  email: string;
  deviceId: string;
  verifiedUntil: string;
  authorizationAccepted: boolean;
};

const DEFAULT_BETA_ACCESS: BetaAccessState = {
  betaId: "",
  email: "",
  deviceId: "",
  verifiedUntil: "",
  authorizationAccepted: false,
};

function isBetaAccessCurrentlyVerified(access: BetaAccessState) {
  if (!access.betaId || !access.email || !access.deviceId || !access.verifiedUntil) {
    return false;
  }

  const expiresAt = Date.parse(access.verifiedUntil);

  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt > Date.now();
}

const APP_SETTINGS_STORAGE_KEY = "fixmygame:app-settings";

type AppSettings = {
  enableSafeFix: boolean;
  askBeforeFixing: boolean;
  createBackupBeforeFix: boolean;
  autoDetectGames: boolean;
  rememberLastGamePath: boolean;
  autoScrollToResults: boolean;
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
  autoScrollToResults: true,
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

async function fetchJSON<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const deviceId = getOrCreateDeviceId();

  const res = await fetch(input, {
    ...init,
    headers: {
  "Content-Type": "application/json",
  "x-fmg-device-id": deviceId,
  "x-fmg-app-version": FIXMYGAME_APP_VERSION,
  "x-fmg-build-channel": FIXMYGAME_BUILD_CHANNEL,
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
      } else if (
        typeof parsed.message === "string" &&
        parsed.message.trim().length > 0
      ) {
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
  },
  missingModAlreadyInstalled?: boolean,
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
        ? "Repair preview"
        : category === "mixin_failure"
          ? "Mixin failure repair preview"
          : category === "java_mismatch"
            ? "Java mismatch repair preview"
            : category === "loader_mismatch"
              ? "Loader mismatch repair preview"
              : category === "mod_conflict"
                ? "Safe repair preview"
                : "Repair preview",
    description: getFixPlanDescription(category, missingModAlreadyInstalled),
    actions,
  };
}

function getConfidenceDisplayLabel(confidence?: string, errorType?: string) {
  if (errorType === "DuplicateModDetected") return "Confirmed";
  return confidence || "Unknown";
}

function getFixPlanDescription(
  category: string,
  missingModAlreadyInstalled?: boolean,
) {
  if (category === "missing_dependency") {
    if (missingModAlreadyInstalled) {
      return "The loaded log reported a missing dependency, but FixMyGame found it already installed on this device. The log may be old, so run the game again and use a fresh log if the issue continues.";
    }

    return "FixMyGame found a missing required mod or dependency. Use the download button to open the correct mod page, then install it into your Mods folder.";
  }

  if (category === "mod_conflict") {
    return "Backs up and quarantines the duplicate or conflicting mod most likely causing the crash.";
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
    const profileName = rawPath.split("instances\\")[1]?.split("\\")[0] || null;

    return {
      manager: "Prism Launcher",
      profileName,
    };
  }

  if (lower.includes("\\modrinthapp\\profiles\\")) {
    const profileName = rawPath.split("profiles\\")[1]?.split("\\")[0] || null;

    return {
      manager: "Modrinth",
      profileName,
    };
  }

  if (lower.includes("\\multimc\\instances\\")) {
    const profileName = rawPath.split("instances\\")[1]?.split("\\")[0] || null;

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
  crashLog?: string,
) {
  const category = signals?.likelyCategory ?? "unknown";
  const loader = signals?.loader ?? "";
  const javaVersion = signals?.javaVersion ?? "";
  const mods = signals?.suspectedMods ?? [];

  const lowerLogPath = String(currentLogPath || "").toLowerCase();

  const stardewModsPath = lowerLogPath.includes("\\stardewvalley\\errorlogs")
    ? "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley\\Mods"
    : "";

  const managerInfo = detectModManagerFromPath(currentLogPath);

  const lowerCrashLog = String(crashLog || "").toLowerCase();

  const stardewSkippedEmptyFolderMatch =
    crashLog?.match(
      /-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's an empty folder\./i,
    ) ||
    crashLog?.match(
      /TRACE SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\(from Mods\\[^)]*\)\.\.\.[\s\S]*?Failed:\s+it's an empty folder\./i,
    );

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
      const badFolder =
        stardewSkippedEmptyFolderMod || mods[0] || "the empty mod folder";

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

    if (category === "loader_mismatch") {
      const leadMod = mods[0] || "the skipped Stardew mod";

      return {
        title: "SMAPI version mismatch",
        bullets: [
          `${leadMod} was skipped because it requires a different SMAPI version.`,
          "Update SMAPI to the latest stable version.",
          `If ${leadMod} still asks for an unavailable SMAPI version, remove it or install a compatible version.`,
          "Launch Stardew Valley again so SMAPI creates a fresh log.",
          "Run FixMyGame again with the fresh log.",
        ],
      };
    }

    if (isAdvisoryCategory(category)) {
      return {
        title: analysis?.issue || "Advisory issue found",
        bullets: [
          analysis?.quickFixFirst || "A non-fatal issue was found in this log.",
          analysis?.mostLikelyCause ||
            "The game may still launch, but this warning should be cleaned up.",
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
          analysis?.quickFixFirst ||
            "Verify Stardew Valley’s game files through Steam.",
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
          `Option A — Fix in ${managerInfo.manager}: Open ${managerInfo.manager}, open "${managerInfo.profileName}", find "${leadMod}", then disable or remove it there.`,
        );
      }

      bullets.push(
        `Fix in Mods Folder: Temporarily move the "${leadMod}" folder out of your Mods folder, then test again.`,
      );

      bullets.push(
        stardewModsPath
          ? `Mods folder: ${stardewModsPath}`
          : "Open your Stardew Valley Mods folder and locate the installer folder.",
      );

      bullets.push(
        "Restart Stardew Valley and check whether your mods load normally.",
      );

      bullets.push(
        "If the issue continues, run another diagnostic after reopening the game.",
      );

      return {
        title: "Installer folder found in Mods",
        bullets,
      };
    }

    const fallbackBullets: string[] = [];

    if (managerInfo?.manager && managerInfo?.profileName && mods.length > 0) {
      fallbackBullets.push(
        `Option A — Fix in ${managerInfo.manager}: Open ${managerInfo.manager}, open "${managerInfo.profileName}", find "${mods[0]}", and disable it there first.`,
      );
    }

    fallbackBullets.push(
      mods.length > 0
        ? `Fix in Mods Folder: Start by removing or disabling ${mods[0]}.`
        : "Fix in Mods Folder: Start by removing the most recently added mod.",
    );

    fallbackBullets.push(
      "Make sure each mod is properly installed (not just extracted or incomplete files).",
    );

    fallbackBullets.push(
      "Restart Stardew Valley and check whether the issue is gone.",
    );

    fallbackBullets.push(
      "If the issue continues, re-run FixMyGame after the next launch.",
    );

    return {
      title: "Crash source identified",
      bullets:
        mods.length > 0
          ? [
              `${mods[0]} failed during startup initialization.`,
              `Remove the current ${mods[0]} install from your Mods folder.`,
              `Reinstall a clean compatible version of ${mods[0]}.`,
              "Relaunch Stardew Valley and confirm the game starts normally.",
            ]
          : fallbackBullets,
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
        "Temporarily disable recently added CC or mods, then relaunch.",
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
          analysis?.mostLikelyCause ||
            "The game may still launch, but this warning should be cleaned up.",
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
          analysis?.mostLikelyCause ||
            "The game may still launch, but this warning should be cleaned up.",
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

  if (gameKey === "lethal_company") {
    if (category === "manifest_not_crash_log") {
      return {
        title: "Manifest file detected",
        bullets: [
          "This is a Thunderstore modpack manifest, not the actual crash log.",
          "It lists required dependencies, but it does not show what failed during launch.",
          "Run Lethal Company until the issue happens again.",
          "Load BepInEx/LogOutput.log instead of manifest.json.",
        ],
      };
    }

    if (category === "missing_dependency") {
      return {
        title: "Missing Lethal Company dependency",
        bullets: [
          mods.length > 0
            ? `${mods[0]} may require another BepInEx/Thunderstore dependency.`
            : "A required BepInEx or Thunderstore dependency may be missing.",
          "Install or update the required dependency through Thunderstore/r2modman.",
          "Make sure every player in multiplayer has the same modpack/profile.",
          "Relaunch Lethal Company after updating dependencies.",
        ],
      };
    }

    return {
      title: "Lethal Company mod / BepInEx issue",
      bullets: [
        mods.length > 0
          ? `Start by checking ${mods[0]}.`
          : "Start by checking the most recently added or updated mod.",
        "Open BepInEx/LogOutput.log and look for the first red error or exception.",
        "Update BepInEx and core libraries first.",
        "If multiplayer is involved, make sure everyone has the same modpack/profile.",
      ],
    };
  }

  if (gameKey === "project_zomboid") {
    if (isAdvisoryCategory(category)) {
      return {
        title: analysis?.issue || "Advisory issue found",
        bullets: [
          analysis?.quickFixFirst || "A non-fatal issue was found in this log.",
          analysis?.mostLikelyCause ||
            "The game may still launch, but this warning should be cleaned up.",
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
          gameKey === "minecraft"
            ? `Install/select Java 17 for Minecraft ${signals?.gameVersion || "1.20.1"}${loader ? ` and ${loader}` : ""}.`
            : "Install the Java version required by your modpack.",
          loader
            ? `Set your ${loader} launcher/profile to use Java 17.`
            : "Set your launcher/profile to use the correct Java version.",
          javaVersion
            ? `Current detected Java: ${javaVersion} is too old for this setup.`
            : "Your current Java version appears too old.",
          "Relaunch the game after changing Java.",
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
          gameKey === "minecraft"
            ? "Install the missing dependency version that matches your Minecraft version."
            : "Install the missing dependency version that matches your game, loader, or mod framework version.",
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
          loader
            ? `Current loader detected: ${loader}.`
            : "Verify which loader your launcher is using.",
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
        title:
          mods.length >= 2
            ? "Duplicate mod conflict detected"
            : "Mod conflict likely",
        bullets: [
          mods.length >= 2
            ? `Likely conflict between: ${mods[0]} ↔ ${mods[1]}`
            : mods.length === 1
              ? `Start by testing without ${mods[0]}.`
              : "Start by disabling the most recently added or updated mod.",
          "Re-enable mods one at a time until the crash returns.",
          gameKey === "minecraft"
            ? "Check that all mods match your Minecraft and loader version."
            : gameKey === "stellaris"
              ? "Check that all mods match your Stellaris version."
              : gameKey === "stardew"
                ? "Check that all mods match your Stardew Valley version."
                : gameKey === "sims4"
                  ? "Check that all mods match your The Sims 4 version."
                  : "Check that all mods match your game version.",
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
      if (analysis?.detectedSignals?.likelyCategory === "wrong_file_loaded") {
        const selectedGameLabel =
          gameKey === "stellaris"
            ? "Stellaris"
            : gameKey === "minecraft"
              ? "Minecraft"
              : gameKey === "stardew"
                ? "Stardew Valley"
                : gameKey === "sims4"
                  ? "The Sims 4"
                  : "the game";

        return {
          title: "Wrong file loaded",
          bullets: [
            analysis?.quickFixFirst ||
              `This looks like a cache/settings/data file, not a ${selectedGameLabel} crash log.`,
            `Reproduce the crash or issue in ${selectedGameLabel}.`,
            `Open the ${selectedGameLabel} crash/error/log folder.`,
            "Sort the folder by Date Modified.",
            "Choose the newest crash, error, or player log created right after the issue happened.",
            "Run FixMyGame again with that newer log.",
          ],
        };
      }

      return {
        title: "General fix path",
        bullets: [
          analysis?.quickFixFirst ||
            "Start with the most likely fix from the analysis.",
          "Remove the most recently added or updated mod first.",
          gameKey === "minecraft"
            ? "Verify loader, Java, and Minecraft versions all match."
            : "Verify the game version, plugin/mod versions, and dependencies all match.",
          "Retest after each single change so you can isolate the issue.",
        ],
      };
  }
}

function getStardewOvernightSaveMods(crashLog: string) {
  const match = String(crashLog || "").match(
    /\[SMAPI\]\s+These mods could be involved:\s*([\s\S]*?)(?:\n\[|$)/i,
  );

  if (!match?.[1]) return [];

  return match[1]
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*-\s*/, "")
        .replace(/\s+\d+(?:\.\d+)*\s*$/, "")
        .trim(),
    )
    .filter(Boolean);
}

function getStardewEntryCrashMod(crashLog: string) {
  const match = String(crashLog || "").match(
    /\[([^\]]+)\]\s+Mod crashed on entry/i,
  );

  return match?.[1]?.trim() || "";
}

function buildSmartFixResultOverride({
  gameKey,
  crashLog,
  currentLogPath,
  analysis,
  detectedSignals,
}: {
  gameKey: string;
  crashLog: string;
  currentLogPath?: string;
  analysis: AnalyzeResponse["analysis"] | null;
  detectedSignals: AnalyzeResponse["detectedSignals"] | null;
}): AnalyzeResponse["analysis"] | null {
  const category =
    analysis?.detectedSignals?.likelyCategory ||
    detectedSignals?.likelyCategory ||
    "";

  const lowerCrashLog = String(crashLog || "").toLowerCase();

  const trimmedCrashLog = String(crashLog || "").trim();

  const looksLikeJsonDataFile =
    (trimmedCrashLog.startsWith("{") && trimmedCrashLog.endsWith("}")) ||
    (trimmedCrashLog.startsWith("[") && trimmedCrashLog.endsWith("]"));

  const hasCrashOrErrorLanguage =
    lowerCrashLog.includes("crash") ||
    lowerCrashLog.includes("exception") ||
    lowerCrashLog.includes("fatal") ||
    lowerCrashLog.includes("error") ||
    lowerCrashLog.includes("failed") ||
    lowerCrashLog.includes("stack trace") ||
    lowerCrashLog.includes("traceback") ||
    lowerCrashLog.includes("mod_manager.cpp") ||
    lowerCrashLog.includes("gamestate.cpp") ||
    lowerCrashLog.includes("pdx_audio.cpp") ||
    lowerCrashLog.includes("could not resolve mod dependency chain") ||
    lowerCrashLog.includes("duplicate mod detected");

  const looksLikeCacheOrSettingsData =
    looksLikeJsonDataFile &&
    !hasCrashOrErrorLanguage &&
    (lowerCrashLog.includes("last_updated") ||
      lowerCrashLog.includes("timestamp") ||
      lowerCrashLog.includes("activity") ||
      lowerCrashLog.includes("claimable_count") ||
      lowerCrashLog.includes("login_history_player_name") ||
      lowerCrashLog.includes("history_player_name_list") ||
      lowerCrashLog.includes("is_need_history_player_name"));

  if (looksLikeCacheOrSettingsData) {
    const selectedGameLabel = GAME_PROFILES[gameKey]?.label || "selected game";

    const selectedGameCrashLogLabel = GAME_PROFILES[gameKey]?.label
      ? `${selectedGameLabel} crash log`
      : "selected game crash log";

    const selectedGameLogFolderLabel = GAME_PROFILES[gameKey]?.label
      ? `${selectedGameLabel} crash/error/log folder`
      : "selected game crash/error/log folder";

    return {
      quickFixFirst: `This looks like a cache/settings/data file, not a ${selectedGameCrashLogLabel}.`,
      issue: `FixMyGame was given a cache/settings/data file instead of a ${selectedGameCrashLogLabel}.`,
      confidenceLevel: "High",
      probabilityBreakdown: [
        "95% - Wrong file loaded / cache or settings data",
        "5% - Incomplete log missing crash lines",
      ],
      mostLikelyCause:
        "The file appears to contain saved player, activity, cache, or settings data instead of crash/error output. FixMyGame cannot diagnose the actual crash from this file.",
      recommendedFixSteps: [
        `Reproduce the crash or issue in ${selectedGameLabel}.`,
        `Open the ${selectedGameLogFolderLabel}.`,
        "Sort the folder by Date Modified.",
        "Choose the newest crash, error, or player log created right after the issue happened.",
        "Run FixMyGame again with that newer log.",
      ],
      needMoreInfo:
        "FixMyGame needs a real crash or error log created immediately after the problem happens, not a cache/settings/data file.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        likelyCategory: "wrong_file_loaded",
        errorType: "CacheSettingsDataFile",
        advisoryLevel: "important",
        advisoryTitle: "Wrong file loaded",
        advisoryMessage:
          "This file looks like cache/settings/data instead of a crash or error log.",
        suspectedMods: [],
      },
    };
  }

  const looksLikeParadoxStellarisLog =
    lowerCrashLog.includes("pdx_audio.cpp") ||
    lowerCrashLog.includes("mod_manager.cpp") ||
    lowerCrashLog.includes("gamestate.cpp") ||
    lowerCrashLog.includes("could not resolve mod dependency chain") ||
    lowerCrashLog.includes("duplicate mod detected");

  if (
    gameKey === "stellaris" &&
    lowerCrashLog.includes("duplicate mod detected")
  ) {
    return {
      quickFixFirst:
        "Delete or disable one duplicate: Expanded Traditions 3 or Expanded Traditions 3 Updated.",
      issue:
        "Two versions of the same Stellaris mod are active at the same time.",
      confidenceLevel: "High",
      probabilityBreakdown: ["100% - Duplicate Stellaris mod conflict"],
      mostLikelyCause:
        "Stellaris is trying to load both Expanded Traditions 3 and Expanded Traditions 3 Updated, which is causing a mod dependency conflict.",
      recommendedFixSteps: [
        "Open your Stellaris mods/playset in the Paradox Launcher.",
        "Disable either Expanded Traditions 3 or Expanded Traditions 3 Updated.",
        "Keep only one version active.",
        "Relaunch Stellaris and load a fresh log if it still crashes.",
      ],
      needMoreInfo:
        "No more info is needed unless the game still crashes after one duplicate mod is disabled.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        errorType: "DuplicateModDetected",
        loader: "Paradox / Stellaris",
        suspectedMods: [
          "Expanded Traditions 3",
          "Expanded Traditions 3 Updated",
        ],
        likelyCategory: "mod_conflict",
      },
    };
  }

  if (gameKey === "project_zomboid" && looksLikeParadoxStellarisLog) {
    return {
      quickFixFirst:
        "This does not look like a Project Zomboid log. It looks like a Stellaris / Paradox mod log.",
      issue:
        "FixMyGame was given a Stellaris-style log while Project Zomboid was selected.",
      confidenceLevel: "High",
      probabilityBreakdown: [
        "90% - Wrong game selected for this log",
        "10% - Similar non-Zomboid mod loader format",
      ],
      mostLikelyCause:
        "The log contains Paradox/Stellaris-style engine lines, not Project Zomboid Lua or Workshop log lines.",
      recommendedFixSteps: [
        "Switch the selected game to Stellaris if available.",
        "If Stellaris is not available yet, mark this as a supported-game request.",
        "Do not run this under Project Zomboid diagnostics.",
        "For this specific log, remove one duplicate mod: Expanded Traditions 3 or Expanded Traditions 3 Updated.",
      ],
      needMoreInfo:
        "FixMyGame needs the selected game to match the log type before it can safely diagnose or repair anything.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        suspectedMods: [
          "Expanded Traditions 3",
          "Expanded Traditions 3 Updated",
        ],
        likelyCategory: "wrong_selected_game",
        advisoryLevel: "important",
        advisoryTitle: "Wrong game selected",
        advisoryMessage:
          "This appears to be a Stellaris / Paradox log, not a Project Zomboid log.",
      },
    };
  }

  const looksLikeWindowsExe =
    lowerCrashLog.includes("this program cannot be run in dos mode") ||
    lowerCrashLog.startsWith("mz") ||
    currentLogPath?.toLowerCase?.().endsWith(".exe");

  if (looksLikeWindowsExe) {
    return {
      quickFixFirst:
        "This looks like a Windows .exe/application file, not a crash log.",
      issue:
        "FixMyGame was given an executable file instead of a readable crash or error log.",
      confidenceLevel: "High",
      probabilityBreakdown: [
        "100% - Windows executable/application file loaded instead of crash log",
      ],
      mostLikelyCause:
        "The selected file is not readable log text. It appears to be an application file.",
      recommendedFixSteps: [
        "Do not upload the .exe file.",
        "Open the game’s real crash/log folder.",
        "For Lethal Company, use BepInEx/LogOutput.log.",
        "Load a .log or .txt file created after the crash happens.",
      ],
      needMoreInfo:
        "FixMyGame needs a readable .log or .txt crash file, not the game/app executable.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        suspectedMods: [],
        likelyCategory: "wrong_file_type_exe",
        advisoryLevel: "important",
        advisoryTitle: "Executable file uploaded instead of crash log",
        advisoryMessage:
          "The selected file is a Windows application file, not a readable crash log.",
      },
    };
  }

  const looksLikeLethalCompanyManifest =
    gameKey === "lethal_company" &&
    lowerCrashLog.includes('"dependencies"') &&
    lowerCrashLog.includes('"version_number"') &&
    lowerCrashLog.includes('"name"') &&
    !lowerCrashLog.includes("bepinex]") &&
    !lowerCrashLog.includes("stack trace") &&
    !lowerCrashLog.includes("exception") &&
    !lowerCrashLog.includes("fatal error");

  if (looksLikeLethalCompanyManifest) {
    const manifestName =
      crashLog.match(/"name"\s*:\s*"([^"]+)"/i)?.[1]?.trim() || "this modpack";

    return {
      quickFixFirst:
        "This looks like a Thunderstore modpack manifest, not the actual crash log.",
      issue:
        "FixMyGame found a dependency list instead of a Lethal Company crash/error log.",
      confidenceLevel: "High",
      probabilityBreakdown: [
        "90% - Manifest file uploaded instead of crash log",
        "10% - Dependency issue may still exist, but the real log is needed to confirm",
      ],
      mostLikelyCause: `${manifestName} lists required mods, but this file does not show the actual crash failure.`,
      recommendedFixSteps: [
        "Run Lethal Company until the crash or issue happens again.",
        "Open the newest BepInEx LogOutput.log created after the issue.",
        "Paste that LogOutput.log into FixMyGame instead of manifest.json.",
      ],
      needMoreInfo:
        "FixMyGame needs the newest BepInEx/LogOutput.log after the crash happens.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        suspectedMods: [manifestName],
        likelyCategory: "manifest_not_crash_log",
        advisoryLevel: "important",
        advisoryTitle: "Manifest uploaded instead of crash log",
        advisoryMessage:
          "This file lists modpack dependencies, but it is not the crash log FixMyGame needs.",
      },
    };
  }

  const stardewSmapiVersionMismatchMatch =
    gameKey === "stardew_valley"
      ? crashLog.match(
          /-\s*([A-Za-z0-9 _.'\-\[\]]+?)\s+\d+(?:\.\d+)*\s+because it needs SMAPI\s+([0-9.]+)\s+or later/i,
        ) ||
        crashLog.match(
          /([A-Za-z0-9 _.'\-\[\]]+?)\s+\(from Mods\\[^)]*\)[\s\S]*?Failed:\s+it needs SMAPI\s+([0-9.]+)\s+or later/i,
        )
      : null;

  if (gameKey === "stardew_valley" && stardewSmapiVersionMismatchMatch) {
    const brokenMod =
      stardewSmapiVersionMismatchMatch[1]?.trim() || "the skipped mod";
    const requiredSmapi =
      stardewSmapiVersionMismatchMatch[2]?.trim() || "a newer SMAPI version";

    const looksUnrealisticSmapi = Number(requiredSmapi.split(".")[0]) >= 10;

    return {
      quickFixFirst: looksUnrealisticSmapi
        ? `${brokenMod} requires SMAPI ${requiredSmapi} or later, which looks unrealistic. Remove ${brokenMod} or install a compatible version.`
        : `${brokenMod} needs SMAPI ${requiredSmapi} or later. Update SMAPI or use a compatible version of the mod.`,
      issue: `${brokenMod} was skipped because it requires SMAPI ${requiredSmapi} or later.`,
      confidenceLevel: "High",
      probabilityBreakdown: [
        `100% - ${brokenMod} requires SMAPI ${requiredSmapi} or later`,
      ],
      mostLikelyCause: looksUnrealisticSmapi
        ? `${brokenMod} appears to require an unrealistic or future SMAPI version, so this mod is probably broken, fake, misconfigured, or not compatible with the current Stardew/SMAPI setup.`
        : `${brokenMod} requires a newer SMAPI version than the one currently installed.`,
      recommendedFixSteps: looksUnrealisticSmapi
        ? [
            `Remove ${brokenMod} from your Stardew Valley Mods folder.`,
            `Install a compatible version of ${brokenMod} if one exists.`,
            "Launch Stardew Valley again so SMAPI creates a fresh log.",
            "Run FixMyGame again with the fresh log.",
          ]
        : [
            "Update SMAPI to the latest stable version.",
            `If ${brokenMod} still requires a newer unavailable SMAPI version, remove it or install a compatible version.`,
            "Launch Stardew Valley again so SMAPI creates a fresh log.",
            "Run FixMyGame again with the fresh log.",
          ],
      needMoreInfo:
        "No more info is needed unless the game still fails after removing or replacing the skipped mod.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        errorType: "SmapiVersionMismatch",
        loader: "SMAPI",
        gameVersion: "",
        suspectedMods: [brokenMod],
        likelyCategory: "loader_mismatch",
      },
    };
  }

  const stardewOvernightSaveMods =
    gameKey === "stardew_valley" ? getStardewOvernightSaveMods(crashLog) : [];

  if (
    gameKey === "stardew_valley" &&
    (lowerCrashLog.includes("the game crashed when saving overnight") ||
      lowerCrashLog.includes("stardewvalley.savegame.save()") ||
      lowerCrashLog.includes("object.minuteselapsed"))
  ) {
    return {
      quickFixFirst:
        "Update Json Assets and SpaceCore first. If the crash continues, temporarily remove Custom Crops and Machines Pack and test sleeping overnight again.",
      issue: "Stardew Valley crashes during overnight save processing.",
      confidenceLevel: "High",
      probabilityBreakdown: [
        "80% - Custom crop/object/machine mod failed during overnight save",
        "15% - Json Assets or SpaceCore compatibility issue",
        "5% - Other mod touching end-of-day processing",
      ],
      mostLikelyCause:
        "A custom object, crop, or machine added by a mod failed during overnight save processing.",
      recommendedFixSteps: [
        "Update Json Assets.",
        "Update SpaceCore.",
        "Update Content Patcher.",
        "Temporarily remove Custom Crops and Machines Pack.",
        "Launch Stardew Valley and sleep overnight again.",
        "If it works, reinstall or replace Custom Crops and Machines Pack with a compatible version.",
      ],
      needMoreInfo:
        "If it still crashes after removing Custom Crops and Machines Pack, load the newest SMAPI log created after the next failed overnight save.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        errorType: "NullReferenceException",
        loader: "SMAPI",
        suspectedMods:
          stardewOvernightSaveMods.length > 0
            ? stardewOvernightSaveMods
            : [
                "Json Assets",
                "SpaceCore",
                "Content Patcher",
                "Custom Crops and Machines Pack",
              ],
        likelyCategory: "mod_conflict",
      },
    };
  }

  const stardewEntryCrashMod =
    gameKey === "stardew_valley" ? getStardewEntryCrashMod(crashLog) : "";

  if (
    gameKey === "stardew_valley" &&
    stardewEntryCrashMod &&
    lowerCrashLog.includes("mod crashed on entry")
  ) {
    return {
      quickFixFirst: `${stardewEntryCrashMod} failed during startup initialization.`,
      issue: `FixMyGame identified ${stardewEntryCrashMod} as the direct crash source.`,
      confidenceLevel: "High",
      probabilityBreakdown: [
        `85% - ${stardewEntryCrashMod} startup failure`,
        "10% - Broken or incomplete mod install",
        "5% - SMAPI or dependency compatibility issue",
      ],
      mostLikelyCause: `${stardewEntryCrashMod} failed while loading and prevented the mod setup from starting correctly.`,
      recommendedFixSteps: [
        `Remove the current ${stardewEntryCrashMod} install from your Mods folder.`,
        `Reinstall a clean compatible version of ${stardewEntryCrashMod}.`,
        "Relaunch Stardew Valley.",
        "Re-run FixMyGame if the crash continues.",
      ],
      needMoreInfo:
        "If this continues after a clean reinstall, load the newest SMAPI log created after the next failed launch.",
      detectedSignals: {
        ...(analysis?.detectedSignals || detectedSignals || {}),
        errorType: "NullReferenceException",
        loader: "SMAPI",
        suspectedMods: [stardewEntryCrashMod],
        likelyCategory: "mod_conflict",
      },
    };
  }

  if (
    gameKey === "stardew_valley" &&
    category === "no_clear_issue_found" &&
    lowerCrashLog.includes("skipped mods") &&
    lowerCrashLog.includes("empty folder")
  ) {
    const modMatch =
      crashLog.match(
        /-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's an empty folder\./i,
      ) ||
      crashLog.match(
        /TRACE SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\(from Mods\\[^)]*\)\.\.\.[\s\S]*?Failed:\s+it's an empty folder\./i,
      );

    const badFolder = modMatch?.[1]?.trim() || "the empty mod folder";

    return {
      quickFixFirst: `You can remove the empty folder for ${badFolder} to clean up the warning.`,
      issue: `There's an empty folder for ${badFolder} in your Mods folder, which is causing a warning.`,
      confidenceLevel: "High",
      probabilityBreakdown: [
        `100% - The empty folder for ${badFolder} is the only issue.`,
      ],
      mostLikelyCause: `The empty folder for ${badFolder} is not being recognized as a valid mod.`,
      recommendedFixSteps: [
        `Remove the empty folder for ${badFolder} from your Mods folder.`,
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
  gameTitle: effectiveGameTitle,
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
    /plugin\s+([A-Za-z0-9_.-]+\.dll)[\s\S]*?reported as incompatible[\s\S]*?expected runtime\s+([0-9.]+),\s*got\s+([0-9.]+)/i,
  );

  if (
    effectiveGameTitle === "Skyrim Special Edition" &&
    skyrimRuntimeMismatchMatch
  ) {
    const pluginName = skyrimRuntimeMismatchMatch[1] || "the SKSE plugin";
    const expectedRuntime =
      skyrimRuntimeMismatchMatch[2] || "the expected runtime";
    const currentRuntime =
      skyrimRuntimeMismatchMatch[3] || "your current runtime";

    return {
      quickFixFirst: `Update ${pluginName} for Skyrim runtime ${currentRuntime}.`,
      issue: `${pluginName} is built for Skyrim runtime ${expectedRuntime}, but your game is running runtime ${currentRuntime}.`,
      confidenceLevel: "High",
      probabilityBreakdown: [`100% - ${pluginName} runtime version mismatch`],
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
    effectiveGameTitle === "Stardew Valley" &&
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
      quickFixFirst: `Start by checking the newest ${effectiveGameTitle} log for the first clear error or failed mod/plugin line.`,
      issue: `FixMyGame could not build a strong diagnosis from this ${effectiveGameTitle} log yet.`,
      confidenceLevel: "Low",
      probabilityBreakdown: [
        "45% - Incomplete or non-crash log",
        "35% - Mod/plugin conflict",
        "20% - Environment or setup issue",
      ],
      mostLikelyCause:
        "The current log may be incomplete, non-fatal, or missing the line that shows the actual failure.",
      recommendedFixSteps: [
        `Launch ${effectiveGameTitle} again and reproduce the issue.`,
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
    !analysis?.recommendedFixSteps || analysis.recommendedFixSteps.length === 0;

  const noClearIssue =
    likelyCategory === "no_clear_issue_found" &&
    (lowerCrashLog.includes("error") ||
      lowerCrashLog.includes("exception") ||
      lowerCrashLog.includes("failed") ||
      lowerCrashLog.includes("traceback") ||
      lowerCrashLog.includes("missing dependency"));

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
    issue: weakIssue
      ? `FixMyGame found signs of a ${effectiveGameTitle} mod, plugin, or setup issue, but the exact failure is not fully confirmed from this log.`
      : analysis!.issue,
    confidenceLevel: analysis?.confidenceLevel || "Medium",
    probabilityBreakdown: analysis?.probabilityBreakdown?.length
      ? analysis.probabilityBreakdown
      : [
          "50% - Mod/plugin conflict",
          "30% - Missing dependency or version mismatch",
          "20% - Wrong or incomplete log",
        ],
    mostLikelyCause: noClearIssue
      ? `The warnings shown are normal SMAPI advisory notes, not confirmed crash causes.`
      : weakCause
        ? `A mod/plugin conflict, missing dependency, version mismatch, or incomplete install is more likely than a clean/no-issue state.`
        : analysis!.mostLikelyCause,
    recommendedFixSteps: weakSteps
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

function buildLoadedLogSummary({ crashLog }: { crashLog: string }) {
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
      line.match(
        /-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's an empty folder\./i,
      ) ||
      line.match(
        /TRACE SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\(from Mods\\[^)]*\)\.\.\.[\s\S]*?Failed:\s+it's an empty folder\./i,
      );

    if (emptyFolderMatch?.[1]) {
      warningKeys.add(
        `empty-folder:${emptyFolderMatch[1].trim().toLowerCase()}`,
      );
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
  const trimmedLog = log.trim();
  const lowerLog = trimmedLog.toLowerCase();

  const looksLikePlainDataFile =
    trimmedLog.startsWith("{") || trimmedLog.startsWith("[");

  const looksLikeCacheSettingsData =
    looksLikePlainDataFile &&
    (lowerLog.includes('"login_history_player_name"') ||
      lowerLog.includes('"last_updated"') ||
      lowerLog.includes('"claimable_count"') ||
      lowerLog.includes('"activity') ||
      lowerLog.includes('"timestamp"') ||
      lowerLog.includes('"history_player_name_list"')) &&
    !/(exception|stack trace|caused by|crash|failed|error|smapi|bepinex|redscript|lua panic)/i.test(
      log,
    );

  if (looksLikeCacheSettingsData) {
    return {};
  }
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
    const loader = lower.includes("fabric")
      ? "Fabric"
      : lower.includes("forge")
        ? "Forge"
        : lower.includes("quilt")
          ? "Quilt"
          : null;

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
        log
          .match(/([A-Za-z0-9_.]*(Exception|Error))(?::\s*[^\n]*)?/i)?.[1]
          ?.trim() || null;

      error = rawError?.toLowerCase() === "error" ? "UnknownError" : rawError;

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

    if (
      lower.includes("the game crashed when saving overnight") ||
      lower.includes("stardewvalley.savegame.save()") ||
      lower.includes("object.minuteselapsed")
    ) {
      issue = "Overnight save crash";
      error = "SaveGameCrash";
    }
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
      log.match(
        /(lastexception|exception|script call failed|tunableperf|mccc)/i,
      )?.[1] || null;

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
      log.match(/(f4se|exception|crash|dll plugin|buffout)/i)?.[1] || null;

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
      log.match(/(error|failed|exception|crash|missing)/i)?.[1] || null;

    return {
      loader: "BG3 Mod Manager / Script Extender",
      java: null,
      issue: error ? "BG3 mod or Script Extender issue" : null,
      error,
    };
  }

  if (gameKey === "lethal_company") {
    let issue: string | null = null;
    let error: string | null = null;

    if (lower.includes("filenotfoundexception") && lower.includes("lc_api")) {
      issue = "Missing or wrong LC_API dependency";
      error = "FileNotFoundException";
    } else if (lower.includes("network prefab hash mismatch")) {
      issue = "Multiplayer mod mismatch";
      error = "NetworkMismatch";
    } else if (lower.includes("bepinex") && lower.includes("failed")) {
      issue = "BepInEx mod/plugin issue";
      error = "BepInExFailure";
    } else {
      error = log.match(/(error|failed|exception|crash|missing)/i)?.[1] || null;
      issue = error ? "Lethal Company mod or BepInEx issue" : null;
    }

    return {
      loader: "BepInEx / Thunderstore",
      java: null,
      issue,
      error,
    };
  }

  if (gameKey === "stellaris") {
    let issue: string | null = null;
    let error: string | null = null;

    if (lower.includes("duplicate mod detected")) {
      issue = "Duplicate mod conflict";
      error = "DuplicateModDetected";
    } else if (lower.includes("could not resolve mod dependency chain")) {
      issue = "Mod dependency chain failure";
      error = "DependencyChain";
    } else if (lower.includes("invalid supported_version")) {
      issue = "Unsupported mod version";
      error = "UnsupportedModVersion";
    } else if (lower.includes("script error")) {
      issue = "Script mod error";
      error = "ScriptError";
    } else {
      error = log.match(/(error|failed|exception|crash|missing)/i)?.[1] || null;
      issue = error ? "Stellaris mod or Paradox launcher issue" : null;
    }

    return {
      loader: "Paradox / Stellaris",
      java: null,
      issue,
      error,
    };
  }

  if (gameKey === "project_zomboid") {
    let issue: string | null = null;
    let error: string | null = null;

    if (
      lower.includes("stack traceback") ||
      lower.includes("attempt to index a nil value")
    ) {
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
        log.match(/(error|failed|exception|crash|traceback|missing)/i)?.[1] ||
        null;
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
    log
      .match(/([A-Za-z0-9_.]*(Exception|Error))(?::\s*[^\n]*)?/i)?.[1]
      ?.trim() ||
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
    gameKey === "minecraft"
      ? minecraftTerms
      : gameKey === "sims4"
        ? simsTerms
        : gameKey === "skyrimse"
          ? skyrimTerms
          : gameKey === "fallout4"
            ? falloutTerms
            : genericTerms;

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
        /\b(examplemod|optifine|sodium|iris|oculus|rubidium|cloth_config|lithium|forge|fabric)\b/gi,
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
    const involvedMods = getStardewOvernightSaveMods(log);
    for (const mod of involvedMods) {
      mods.add(mod.toLowerCase());
    }
    for (const line of lines) {
      const skippedModMatch = line.match(
        /-\s*([A-Za-z0-9 _.'\-\[\]]+)\s+because it's/i,
      );
      if (skippedModMatch?.[1]) {
        mods.add(skippedModMatch[1].trim().toLowerCase());
      }

      const fromModsMatch = line.match(/from Mods\\([^\\,\]]+)/i);
      if (fromModsMatch?.[1]) {
        mods.add(fromModsMatch[1].trim().toLowerCase());
      }

      const smapiNamedMatch = line.match(
        /\[INFO\s+SMAPI\]\s+([A-Za-z0-9 _.'\-\[\]]+)\s+\d/i,
      );
      if (smapiNamedMatch?.[1]) {
        mods.add(smapiNamedMatch[1].trim().toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "sims4") {
    for (const line of lines) {
      const matches = line.match(
        /\b(mccc|wickedwhims|basemental|ui cheats|better exceptions|xml injector|tmex)\b/gi,
      );
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "skyrimse") {
    for (const line of lines) {
      const matches = line.match(
        /\b(skse|address library|enb|dyndolod|fnis|nemesis|skyui|ussep)\b/gi,
      );
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "fallout4") {
    for (const line of lines) {
      const matches = line.match(
        /\b(f4se|buffout|looksmenu|mcm|sim settlements|unofficial patch)\b/gi,
      );
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "cyberpunk2077") {
    for (const line of lines) {
      const matches = line.match(
        /\b(redscript|red4ext|cyber engine tweaks|archive xl|tweakxl|codeware|redmod)\b/gi,
      );
      if (matches) {
        for (const name of matches) mods.add(name.toLowerCase());
      }

      const archiveMatch = line.match(
        /archive[\/\\]pc[\/\\]mod[\/\\]([a-z0-9._ -]+)/i,
      );
      if (archiveMatch?.[1]) {
        mods.add(archiveMatch[1].trim().toLowerCase());
      }
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "baldurs_gate_3") {
    for (const line of lines) {
      const matches = line.match(
        /\b(script extender|bg3 mod manager|improvedui|mod fixer|lslib|gustav)\b/gi,
      );
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

  if (gameKey === "stellaris") {
    const duplicateMatch = log.match(
      /duplicate mod detected:\s*["']?([^"'\n\r]+)["']?\s*(?:\r?\n)?\s*and\s*(?:\r?\n)?\s*["']?([^"'\n\r]+)["']?/i,
    );

    if (duplicateMatch?.[1]) mods.add(duplicateMatch[1].trim().toLowerCase());
    if (duplicateMatch?.[2]) mods.add(duplicateMatch[2].trim().toLowerCase());

    for (const line of lines) {
      const pathMatch = line.match(/mod\/([^\/\\\s]+)\/descriptor\.mod/i);
      if (pathMatch?.[1]) mods.add(pathMatch[1].trim().toLowerCase());
    }

    return Array.from(mods).slice(0, 8);
  }

  if (gameKey === "project_zomboid") {
    for (const line of lines) {
      const matches = line.match(
        /\b(workshop|mod id|map folder|lua|b41|b42)\b/gi,
      );
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
    lower.includes("lethal company") ||
    lower.includes("lethalcompany") ||
    lower.includes("\\lethal company\\") ||
    lower.includes("\\lethalcompany\\") ||
    lower.includes("/lethal company/") ||
    lower.includes("/lethalcompany/") ||
    lower.includes("bepinex") ||
    lower.includes("bepinexpack") ||
    lower.includes("latecompany") ||
    lower.includes("morecompany") ||
    lower.includes("lethallib") ||
    lower.includes("lc_api") ||
    lower.includes("thunderstore") ||
    lower.includes("r2modman") ||
    lower.includes("logoutput.log")
  ) {
    return "lethal_company";
  }
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
    lower.includes("garry's mod") ||
    lower.includes("garry mod") ||
    lower.includes("\\garrysmod\\") ||
    lower.includes("/garrysmod/") ||
    lower.includes("lua panic")
  ) {
    return "gmod";
  }

  if (lower.includes("stardew valley") || lower.includes("smapi")) {
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
    lower.includes("stellaris") ||
    lower.includes("pdx_audio.cpp") ||
    lower.includes("mod_manager.cpp") ||
    lower.includes("gamestate.cpp") ||
    lower.includes("could not resolve mod dependency chain") ||
    lower.includes("duplicate mod detected") ||
    lower.includes("descriptor.mod")
  ) {
    return "stellaris";
  }

  if (
    lower.includes("project zomboid") ||
    lower.includes("zomboid") ||
    lower.includes("pz.log") ||
    lower.includes("lua checksum") ||
    lower.includes("workshop item version") ||
    lower.includes("stack traceback") ||
    lower.includes("attempt to index a nil value")
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
      line.toLowerCase().includes("missing dependency"),
    );
    if (dependencyLine) return dependencyLine;

    const failedLoadingLine = lines.find((line) =>
      line.toLowerCase().includes("failed loading"),
    );
    if (failedLoadingLine) return failedLoadingLine;

    const mismatchLine = lines.find((line) =>
      line.toLowerCase().includes("mismatch"),
    );
    if (mismatchLine) return mismatchLine;
  }

  if (gameKey === "cyberpunk2077") {
    const dependencyLine = lines.find((line) =>
      line.toLowerCase().includes("missing dependency"),
    );
    if (dependencyLine) return dependencyLine;

    const failedLine = lines.find((line) =>
      line.toLowerCase().includes("failed"),
    );
    if (failedLine) return failedLine;

    const exceptionLine = lines.find((line) =>
      line.toLowerCase().includes("exception"),
    );
    if (exceptionLine) return exceptionLine;
  }

  if (gameKey === "stellaris") {
    const duplicateLine = lines.find((line) =>
      line.toLowerCase().includes("duplicate mod detected"),
    );
    if (duplicateLine) return duplicateLine;

    const dependencyLine = lines.find((line) =>
      line.toLowerCase().includes("could not resolve mod dependency chain"),
    );
    if (dependencyLine) return dependencyLine;

    const supportedVersionLine = lines.find((line) =>
      line.toLowerCase().includes("invalid supported_version"),
    );
    if (supportedVersionLine) return supportedVersionLine;
  }

  if (gameKey === "project_zomboid") {
    const tracebackLine = lines.find((line) =>
      line.toLowerCase().includes("traceback"),
    );
    if (tracebackLine) return tracebackLine;

    const nilValueLine = lines.find((line) =>
      line.toLowerCase().includes("nil value"),
    );
    if (nilValueLine) return nilValueLine;

    const failedModLine = lines.find((line) =>
      line.toLowerCase().includes("failed to load"),
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
  gameLabel: string,
) {
  switch (context) {
    case "autoDetect":
      return {
        eyebrow: "FIXMYGAME PRO",
        title: `Upgrade to unlock automatic ${gameLabel} log discovery`,
        description: `FixMyGame Pro can automatically find likely ${gameLabel} logs, load the best one, and make troubleshooting much faster.`,
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
        description: `FixMyGame Pro can scan an entire folder, find likely ${gameLabel} logs, and load the best one automatically.`,
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
        description: `FixMyGame Pro lets you save your ${gameLabel} results to a file so you can keep them, share them, or compare them later.`,
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
        description: `FixMyGame Pro gives you a faster, more complete way to diagnose ${gameLabel} crashes without manual digging.`,
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
  { key: "stellaris", label: "Stellaris" },
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
  stellaris: {
    label: "Stellaris",
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

const API_BASE_URL = "";

const SORTED_GAME_PRESETS = [
  ...GAME_PRESETS.filter((g) => g.key !== "custom").sort((a, b) =>
    a.label.localeCompare(b.label),
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
      description:
        "FixMyGame is analyzing your crash log and building a repair plan.",
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
  const [detectedGameKey, setDetectedGameKey] = useState<string | null>(null);
  const [hasAppliedAutoGameDetect, setHasAppliedAutoGameDetect] =
    useState(false);
  const [hasAcceptedAuthorization, setHasAcceptedAuthorization] =
    useState(false);
  const [checkingAuthorization, setCheckingAuthorization] = useState(true);
  const [supportTelemetryEnabled, setSupportTelemetryEnabled] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);
  const [showBetaShareModal, setShowBetaShareModal] = useState(false);
  const [betaShareReturnTarget, setBetaShareReturnTarget] = useState<
  "settings" | null
>(null);
const [hasLoadedBetaAccess, setHasLoadedBetaAccess] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"privacy" | "app" | "Updates & Links">("privacy");
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
  const [gameInstallDetected, setGameInstallDetected] = useState<
    boolean | null
  >(null);
  const [gameInstallPath, setGameInstallPath] = useState("");
  const [checkingInstall, setCheckingInstall] = useState(false);

  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState(3);
  const [remaining, setRemaining] = useState(3);
  const [isBetaAccess, setIsBetaAccess] = useState(false);
  const [betaAccess, setBetaAccess] =
  useState<BetaAccessState>(DEFAULT_BETA_ACCESS);
const [betaAccessEmailInput, setBetaAccessEmailInput] = useState("");
const [betaAccessIdInput, setBetaAccessIdInput] = useState("");
const [verifyingBetaAccess, setVerifyingBetaAccess] = useState(false);
const [betaAccessMessage, setBetaAccessMessage] = useState("");
  const betaAccessVerified = isBetaAccessCurrentlyVerified(betaAccess);
const shouldShowBetaAccessGate = !isPro && !betaAccessVerified;
const hasUnlimitedAccess = isPro || betaAccessVerified;
  const appLocked =
    process.env.NEXT_PUBLIC_APP_LOCKED === "1" &&
    typeof window !== "undefined" &&
    !window.fixMyGame;

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
  const [hasRunDiagnosticThisSession, setHasRunDiagnosticThisSession] =
    useState(false);
  const [shouldAutoScrollToResult, setShouldAutoScrollToResult] =
    useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [folderActionError, setFolderActionError] = useState("");
  const [quickActionFolderError, setQuickActionFolderError] = useState("");
  function setTimedError(
    setter: (value: string) => void,
    message: string,
    duration = 4000,
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
  const [fixHistoryTab, setFixHistoryTab] = useState<"saved" | "diagnostics">(
    "saved",
  );
  const [actionMsgLocation, setActionMsgLocation] = useState<
    "fixAssistant" | "smartFix" | "diagnostic" | null
  >(null);
  const [diagnosticMarkedFixed, setDiagnosticMarkedFixed] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [applyingSafeFix, setApplyingSafeFix] = useState(false);
  const [undoingSafeFix, setUndoingSafeFix] = useState(false);
  const [lastUndoSucceeded, setLastUndoSucceeded] = useState(false);
  const [proModalContext, setProModalContext] = useState<
    "autoDetect" | "folderScan" | "saveAnalysis"
  >("autoDetect");
  const [detectedLogs, setDetectedLogs] = useState<
    { name: string; fullPath: string; lastModified?: number; size?: number }[]
  >([]);
  const [hasScannedLogs, setHasScannedLogs] = useState(false);
  const [detectedSignals, setDetectedSignals] = useState<
    AnalyzeResponse["detectedSignals"] | null
  >(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse["analysis"] | null>(
    null,
  );
  const [quickSignals, setQuickSignals] = useState<{
    status?: string | null;
    session?: string | null;
    loader?: string | null;
    java?: string | null;
    issue?: string | null;
    error?: string | null;
  }>({});
  const [autoDetectNotice, setAutoDetectNotice] = useState("");
  const [debugVid, setDebugVid] = useState("");
  const [debugProStatus, setDebugProStatus] = useState("");
  const [fixExecutionResults, setFixExecutionResults] = useState<
    FixExecutionResult[]
  >([]);
  const [fixFeedbackConfirmed, setFixFeedbackConfirmed] = useState(false);
  const [repairTimeline, setRepairTimeline] = useState<RepairTimelineItem[]>(
    [],
  );
  const [runningFixPlan, setRunningFixPlan] = useState(false);
  const [fixHistoryItems, setFixHistoryItems] = useState<FixHistoryItem[]>([]);
  const [logHighlights, setLogHighlights] = useState<string[]>([]);
  const [liveMods, setLiveMods] = useState<string[]>([]);
  const [mostSuspiciousLine, setMostSuspiciousLine] = useState<string | null>(
    null,
  );
  const [showFixFeedback, setShowFixFeedback] = useState(false);
  const [continuedDiagnosticBase, setContinuedDiagnosticBase] =
    useState<FixHistoryItem | null>(null);
  const [resultFollowupMessage, setResultFollowupMessage] = useState("");
  const [resultFollowupTone, setResultFollowupTone] = useState<
    "success" | "info" | "warning" | null
  >(null);
  const [showDiagnosticRefineBox, setShowDiagnosticRefineBox] = useState(false);
  const [diagnosticRefineMode, setDiagnosticRefineMode] = useState<
    "continue" | "still_crashing" | null
  >(null);
  const [diagnosticRefineText, setDiagnosticRefineText] = useState("");
  const [showAdditionalRefineLogBox, setShowAdditionalRefineLogBox] =
    useState(false);
  const [additionalRefineLog, setAdditionalRefineLog] = useState("");
  const [lastFixResult, setLastFixResult] = useState<{
    movedFile?: string;
    matchedName?: string;
    matchedSuspect?: string;
    itemType?: "file" | "folder";
    candidateKind?:
      | "empty_folder"
      | "invalid_loose_file"
      | "mod_file"
      | "mod_folder";
    backupPath?: string;
    quarantinePath?: string;
    originalPath?: string;
    mods?: string[];
  } | null>(null);
  const diagnosticResultRef = useRef<HTMLElement | null>(null);
  const fixResultsRef = useRef<HTMLDivElement | null>(null);
  const fixAssistantScrollRef = useRef<HTMLDivElement | null>(null);
  const continueResultRef = useRef<HTMLDivElement | null>(null);
  const diagnosticBottomRef = useRef<HTMLDivElement | null>(null);
  const [diagnosticFeedback, setDiagnosticFeedback] = useState<
  "helpful" | "needs_work" | null
>(null);

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
        JSON.stringify(appSettings),
      );
    } catch {
      // ignore storage errors
    }
  }, [appSettings]);

 useEffect(() => {
  if (!hasLoadedBetaAccess) return;

  try {
    window.localStorage.setItem(
      BETA_ACCESS_STORAGE_KEY,
      JSON.stringify(betaAccess),
    );

    setIsBetaAccess(isBetaAccessCurrentlyVerified(betaAccess));
  } catch {
    // ignore storage errors
  }
}, [betaAccess, hasLoadedBetaAccess]);

  useEffect(() => {
    if (!appSettings.autoDetectGames) {
      setDetectedGameKey(null);
      setAutoDetectNotice("");
      return;
    }

    const trimmed = crashLog.trim();

    if (!trimmed) {
      setAutoDetectNotice("");
      return;
    }

    const detectedGame = detectGameFromLog(crashLog);

    if (!detectedGame) {
      setDetectedGameKey(null);
      setHasAppliedAutoGameDetect(false);

      if (trimmed.length > 40) {
        setAutoDetectNotice(
          `FixMyGame will keep using your selected game: ${gameTitle}. If this is not the game you meant, choose the correct game before running the diagnostic.`,
        );
      }

      setQuickSignals({});
      setLogHighlights([]);
      setLiveMods([]);
      setMostSuspiciousLine(null);
      return;
    }

    setAutoDetectNotice("");
    setDetectedGameKey(detectedGame);

    if (detectedGame !== selectedGameKey) {
      setSelectedGameKey(detectedGame);

      showActionMessage(
        `Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`,
        "fixAssistant",
      );
    }

    setQuickSignals(quickDetect(crashLog, detectedGame));
    setLogHighlights(extractLogHighlights(crashLog, detectedGame));
    setLiveMods(extractModsFromLog(crashLog, detectedGame));
    setMostSuspiciousLine(getMostSuspiciousLine(crashLog, detectedGame));
  }, [appSettings.autoDetectGames]);

  useEffect(() => {
    if (showDiagnosticRefineBox && diagnosticRefineMode === "still_crashing") {
      scrollToContinueFromResult();
    }
  }, [showDiagnosticRefineBox, diagnosticRefineMode]);

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
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [selectedGameKey, gpuModel, driverVersion, graphicsApiMode]);

  const canRun = useMemo(
  () => isPro || betaAccessVerified,
  [isPro, betaAccessVerified],
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
    ],
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
    () =>
      GAME_PRESETS.find((g) => g.key === selectedGameKey) ??
      SORTED_GAME_PRESETS[0],
    [selectedGameKey],
  );

  const gameTitle = selectedGame.label;

  const effectiveGameKey = detectedGameKey || selectedGameKey;

  const effectiveGameProfile =
    GAME_PROFILES[effectiveGameKey] ?? GAME_PROFILES[selectedGameKey];

  const effectiveGameTitle =
    GAME_PROFILES[effectiveGameKey]?.label || gameTitle;

  const smartFixResultOverride = useMemo(
    () =>
      buildSmartFixResultOverride({
        gameKey: effectiveGameKey,
        crashLog,
        currentLogPath,
        analysis,
        detectedSignals,
      }),
    [effectiveGameKey, crashLog, currentLogPath, analysis, detectedSignals],
  );

  const universalFallbackOverride = useMemo(
    () =>
      buildUniversalFallbackOverride({
        gameTitle,
        crashLog,
        analysis: smartFixResultOverride ?? analysis,
        detectedSignals,
      }),
    [gameTitle, crashLog, analysis, detectedSignals, smartFixResultOverride],
  );

  const displayAnalysis =
    smartFixResultOverride ?? universalFallbackOverride ?? analysis;

  const displayDetectedSignals =
    displayAnalysis?.detectedSignals || detectedSignals;

  const smartFixPath = useMemo(
    () =>
      getSmartFixPath(
        displayDetectedSignals,
        displayAnalysis,
        effectiveGameKey,
        currentLogPath,
        crashLog,
      ),
    [
      displayDetectedSignals,
      displayAnalysis,
      effectiveGameKey,
      currentLogPath,
      crashLog,
    ],
  );

  const loadedLogSummary = useMemo(
    () =>
      buildLoadedLogSummary({
        crashLog,
      }),
    [effectiveGameKey, crashLog],
  );

  useEffect(() => {
    if (!shouldAutoScrollToResult || !displayAnalysis || !result || running)
      return;

    if (!appSettings.autoScrollToResults) {
      setShouldAutoScrollToResult(false);
      return;
    }

    const timer = window.setTimeout(() => {
      diagnosticResultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setShouldAutoScrollToResult(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    shouldAutoScrollToResult,
    displayAnalysis,
    result,
    running,
    appSettings.autoScrollToResults,
  ]);

  function resetLiveSessionState() {
    setCrashLog("");
    setCurrentLogPath("");
    setDetectedLogs([]);
    setDetectedGameKey(null);
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
    setAutoDetectNotice("");

    setErrorMsg("");
    setFolderActionError("");
    setQuickActionFolderError("");
    setActionMsg("");
    setActionMsgLocation(null);

    setFixExecutionResults([]);
    setRepairTimeline([]);
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
  normalized === "curios" ||
  normalized.includes("curios api") ||
  normalized.includes("curios")
) {
  return "https://modrinth.com/mod/curios";
}
    if (
      normalized === "jei" ||
      normalized.includes("just enough items") ||
      normalized.includes("mezz jei")
    ) {
      return "https://modrinth.com/mod/jei";
    }
    if (normalized.includes("fabric api") || normalized.includes("fabricapi")) {
      return "https://modrinth.com/mod/fabric-api";
    }

    if (normalized.includes("content patcher")) {
      return "https://www.nexusmods.com/stardewvalley/mods/1915";
    }

    if (normalized.includes("smapi")) {
      return "https://smapi.io/";
    }

    if (
      normalized.includes("lc api") ||
      normalized.includes("lcapi") ||
      normalized.includes("lc_api")
    ) {
      return "https://www.nexusmods.com/lethalcompany/mods/67";
    }

    if (normalized.includes("bepinex") || normalized.includes("bepinexpack")) {
      return "https://thunderstore.io/c/lethal-company/p/BepInEx/BepInExPack/";
    }

    if (normalized.includes("latecompany")) {
      return "https://thunderstore.io/c/lethal-company/p/anormaltwig/LateCompany/";
    }

    if (normalized.includes("morecompany")) {
      return "https://thunderstore.io/c/lethal-company/p/notnotnotswipez/MoreCompany/";
    }

    return "";
  }

  function getPrimaryMissingModName() {
  const steps = displayAnalysis?.recommendedFixSteps || [];

  const currentResultText = [
    displayAnalysis?.quickFixFirst || "",
    displayAnalysis?.issue || "",
    displayAnalysis?.mostLikelyCause || "",
    ...steps,
    displayAnalysis?.needMoreInfo || "",
    displayAnalysis?.explanation?.whatThisMeans || "",
    displayAnalysis?.explanation?.beginnerExplanation || "",
    ...(displayAnalysis?.explanation?.whyFixMyGameThinksThis || []),
  ]
    .join("\n")
    .toLowerCase();

  // Current refined result should win over the older original crashLog.
  if (
    currentResultText.includes("curios") ||
    currentResultText.includes("theillusivec4")
  ) {
    return "Curios";
  }

  if (
    currentResultText.includes("just enough items") ||
    currentResultText.includes("jei") ||
    currentResultText.includes("mezz.jei") ||
    currentResultText.includes("mezz/jei")
  ) {
    return "Just Enough Items (JEI)";
  }

  if (currentResultText.includes("content patcher")) {
    return "Content Patcher";
  }

  if (
    currentResultText.includes("fabric api") ||
    currentResultText.includes("fabricapi")
  ) {
    return "Fabric API";
  }

  if (currentResultText.includes("smapi")) {
    return "SMAPI";
  }

  if (
    currentResultText.includes("lc api") ||
    currentResultText.includes("lc_api") ||
    currentResultText.includes("lc-api")
  ) {
    return "LC_API";
  }

  if (currentResultText.includes("bepinex")) {
    return "BepInExPack";
  }

  if (currentResultText.includes("latecompany")) {
    return "LateCompany";
  }

  if (currentResultText.includes("morecompany")) {
    return "MoreCompany";
  }

  const genericMatch =
    currentResultText.match(/missing mod called ([a-z0-9 '\-\[\]\(\)&._]+)/i) ||
    currentResultText.match(/requires mods? which aren't installed \(([^:]+):/i) ||
    currentResultText.match(/install the missing ([a-z0-9 '\-\[\]\(\)&._]+) mod/i) ||
    currentResultText.match(/install the ([a-z0-9 '\-\[\]\(\)&._]+) mod/i);

  const generic = genericMatch?.[1]?.trim();

  if (generic) {
    return generic
      .replace(/\s+for minecraft.*$/i, "")
      .replace(/\s+to resolve.*$/i, "")
      .replace(/\.$/, "")
      .trim();
  }

  // Only use the original crash log as a fallback if the current displayed
  // diagnostic did not identify a missing mod.
  const fallbackText = String(crashLog || "").toLowerCase();

  if (fallbackText.includes("curios") || fallbackText.includes("theillusivec4")) {
    return "Curios";
  }

  if (
    fallbackText.includes("just enough items") ||
    fallbackText.includes("jei") ||
    fallbackText.includes("mezz.jei") ||
    fallbackText.includes("mezz/jei")
  ) {
    return "Just Enough Items (JEI)";
  }

  return "";
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
      setErrorMsg(
        "No missing mod name could be identified from this diagnosis.",
      );
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
          "fixAssistant",
        );
      } else {
        showActionMessage(
          `${modName} was not found in the common local mod locations we searched.`,
          "fixAssistant",
        );
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to search for the missing mod.",
      );
    } finally {
      setSearchingMissingMod(false);
    }
  }

  async function moveFoundModIntoModsFolder() {
    const modName = missingModRecoveryTarget;
    if (!modName) {
      setErrorMsg(
        "No missing mod name could be identified from this diagnosis.",
      );
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
          : prev,
      );

      showActionMessage(
        result.alreadyInCorrectPlace
          ? `${modName} is already in the correct Mods folder.`
          : `${modName} was successfully moved into the Mods folder.`,
        "fixAssistant",
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to move the missing mod.",
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
      showActionMessage(
        "Opened the missing mod download page.",
        "fixAssistant",
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to open the download page.",
      );
    }
  }

  function applyDetectedGameOnce(detectedGame: string | null) {
    if (!appSettings.autoDetectGames) return;
    if (!detectedGame) return;

    if (!hasAppliedAutoGameDetect && detectedGame !== selectedGameKey) {
      setSelectedGameKey(detectedGame);
      setHasAppliedAutoGameDetect(true);

      showActionMessage(
        `Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`,
        "fixAssistant",
      );
    }
  }

  const proModalContent = useMemo(
    () => getProModalContent(proModalContext, gameTitle),
    [proModalContext, gameTitle],
  );

  function getActiveGameKeyForLoadedLog(contents: string) {
    const trimmed = contents.trim();

    if (!appSettings.autoDetectGames) {
      setDetectedGameKey(null);
      setHasAppliedAutoGameDetect(false);
      setAutoDetectNotice("");
      return selectedGameKey;
    }

    const detectedGame = detectGameFromLog(contents);

    if (!detectedGame) {
      setDetectedGameKey(null);
      setHasAppliedAutoGameDetect(false);

      if (trimmed.length > 40) {
        setAutoDetectNotice(
          `FixMyGame will keep using your selected game: ${gameTitle}. If this is not the game you meant, choose the correct game before running the diagnostic.`,
        );
      } else {
        setAutoDetectNotice("");
      }

      return selectedGameKey;
    }

    setAutoDetectNotice("");
    setDetectedGameKey(detectedGame);
    setHasAppliedAutoGameDetect(true);

    if (detectedGame !== selectedGameKey) {
      setSelectedGameKey(detectedGame);

      showActionMessage(
        `Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`,
        "fixAssistant",
      );
    }

    return detectedGame;
  }

  function showActionMessage(
    message: string,
    location: "fixAssistant" | "smartFix" | "diagnostic",
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

  function openBetaInvitePage() {
    if (window.fixMyGame?.openExternalUrl) {
      window.fixMyGame.openExternalUrl(FIXMYGAME_BETA_INVITE_URL);
      return;
    }

    window.open(FIXMYGAME_BETA_INVITE_URL, "_blank", "noopener,noreferrer");
  }

  function openDonationPage() {
  if (window.fixMyGame?.openExternalUrl) {
    window.fixMyGame.openExternalUrl(FIXMYGAME_DONATION_URL);
    return;
  }

  window.open(FIXMYGAME_DONATION_URL, "_blank", "noopener,noreferrer");
}

function closeWhatsNewModal() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, "true");
  }

  setShowWhatsNewModal(false);
}

function buildBetaInviteText() {
  return `I’m testing FixMyGame, an AI crash diagnostic tool for modded PC games.

It helps read crash logs and explain:
- what broke
- why FixMyGame thinks that
- what to try first
- what not to delete

You can see more about it here:
${FIXMYGAME_BETA_INVITE_URL}


Request beta access directly:
${FIXMYGAME_BETA_FORM_URL}

`;
}

function openEmailBetaInvite() {
  const subject = encodeURIComponent("FixMyGame beta invite");
  const body = encodeURIComponent(buildBetaInviteText());

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function copyBetaInviteText() {
  try {
    await copyTextReliable(buildBetaInviteText());
    showActionMessage(
      "Beta invite copied. Paste it into Discord, text, email, or anywhere else.",
      "diagnostic",
    );
    setBetaShareReturnTarget(null);
    setShowBetaShareModal(false);
  } catch {
    setErrorMsg("Could not copy the beta invite text.");
  }
}

function openBetaFormPage() {
  if (window.fixMyGame?.openExternalUrl) {
    window.fixMyGame.openExternalUrl(FIXMYGAME_BETA_FORM_URL);
    return;
  }

  window.open(FIXMYGAME_BETA_FORM_URL, "_blank", "noopener,noreferrer");
}

async function verifyBetaAccess() {
  const betaId = betaAccessIdInput.trim().toUpperCase();
  const email = betaAccessEmailInput.trim().toLowerCase();
  const deviceId = getOrCreateDeviceId();

  if (!betaId || !email) {
    setBetaAccessMessage("Enter your approved beta email and Beta ID.");
    return;
  }

  setVerifyingBetaAccess(true);
  setBetaAccessMessage("");

  try {
    const response = await fetchJSON<{
      ok: boolean;
      betaId?: string;
      email?: string;
      deviceId?: string;
      verifiedUntil?: string;
      authorizationAccepted?: boolean;
      error?: string;
    }>(`${API_BASE_URL}/api/beta-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-fmg-device-id": deviceId,
      },
      body: JSON.stringify({
        betaId,
        email,
        deviceId,
      }),
    });

    if (!response.ok) {
      throw new Error(response.error || "Beta verification failed.");
    }

    const nextBetaAccess = {
      betaId: response.betaId || betaId,
      email: response.email || email,
      verifiedUntil: response.verifiedUntil || "",
      deviceId: response.deviceId || deviceId,
      authorizationAccepted: response.authorizationAccepted === true,
    };

    setBetaAccess(nextBetaAccess);
    setBetaAccessIdInput(nextBetaAccess.betaId);
    setBetaAccessEmailInput(nextBetaAccess.email);
    setIsBetaAccess(true);
    setHasAcceptedAuthorization(nextBetaAccess.authorizationAccepted);

if (nextBetaAccess.authorizationAccepted) {
  setSupportTelemetryEnabled(true);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_AUTH_STORAGE_KEY, "true");
    window.localStorage.setItem(SUPPORT_TELEMETRY_STORAGE_KEY, "true");
  }
} else if (typeof window !== "undefined") {
  window.localStorage.removeItem(APP_AUTH_STORAGE_KEY);
}
    setBetaAccessMessage("Beta access verified on this device.");
  } catch (error) {
    setBetaAccessMessage(
      error instanceof Error
        ? error.message
        : "Beta verification failed. Please try again.",
    );
  } finally {
    setVerifyingBetaAccess(false);
  }
}

function openDiscordPage() {
  if (window.fixMyGame?.openExternalUrl) {
    window.fixMyGame.openExternalUrl(FIXMYGAME_DISCORD_URL);
    return;
  }

  window.open(FIXMYGAME_DISCORD_URL, "_blank", "noopener,noreferrer");
}

function openFeedbackFormPage() {
  if (window.fixMyGame?.openExternalUrl) {
    window.fixMyGame.openExternalUrl(FIXMYGAME_FEEDBACK_FORM_URL);
    return;
  }

  window.open(FIXMYGAME_FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
}

 function openSupportEmail() {
  const subject = encodeURIComponent(
    `FixMyGame Issue Report — ${gameTitle || "Unknown Game"}`,
  );

  const resultTitle =
    displayAnalysis?.issue ||
    analysis?.issue ||
    "No diagnostic result available";

  const confidenceLevel =
    displayAnalysis?.confidenceLevel ||
    analysis?.confidenceLevel ||
    "Not available";

  const body = encodeURIComponent(`
Describe your issue here:

What happened:
What did you expect:
Steps to reproduce:
Did the game crash or did FixMyGame behave incorrectly:


IMPORTANT -- (Please leave the technical details below — they help us fix your issue faster.)
---

App Version: ${FIXMYGAME_APP_VERSION}
Build Channel: ${FIXMYGAME_BUILD_CHANNEL}
Session ID: ${supportSessionId || "Not available"}
Route Version: v2-diagnostic-mapping
Game: ${gameTitle || "Not selected"}
GPU: ${gpuModel || "Not provided"}
Driver: ${driverVersion || "Not provided"}
Graphics API: ${graphicsApiMode || "Not provided"}

---

Continuation Mode: ${continuedDiagnosticBase ? "Active" : "Not Active"}
Additional Crash Log Provided: Not tracked in support email

---

Last Diagnostic Result:
${result ? result.slice(0, 1500) : resultTitle}

Confidence Level: ${confidenceLevel}

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

Suspected Mods:
Not separately listed

---

Quick Fix:
${
  displayAnalysis?.quickFixFirst ||
  analysis?.quickFixFirst ||
  "Not available"
}

---

(Optional) Crash Log Snippet:
${crashLog ? crashLog.slice(0, 1500) : "Not provided"}

`);

  window.location.href = `mailto:fixmygame.support@gmail.com?subject=${subject}&body=${body}`;
}

function submitDiagnosticFeedback(rating: "helpful" | "needs_work") {
  setDiagnosticFeedback(rating);

  recordEmergencyEvent({
    type: "feedback_submitted",
    sessionId: supportSessionId,
    appVersion: FIXMYGAME_APP_VERSION,
    routeVersion: "v2-diagnostic-mapping",
    game: effectiveGameTitle,
    resultCategory:
      displayAnalysis?.detectedSignals?.likelyCategory ||
      displayDetectedSignals?.likelyCategory ||
      analysis?.detectedSignals?.likelyCategory ||
      detectedSignals?.likelyCategory,
    resultTitle:
      displayAnalysis?.issue ||
      analysis?.issue ||
      result?.slice(0, 120) ||
      "No diagnostic result title available",
    confidence:
      displayAnalysis?.confidenceLevel ||
      analysis?.confidenceLevel ||
      "Not available",
    message:
      rating === "helpful"
        ? "User marked diagnostic result as helpful"
        : "User marked diagnostic result as needs work",
    metadata: {
      source: "diagnostic_result_helpfulness",
      feedbackRating: rating,
      hasAnalysis: Boolean(displayAnalysis || analysis),
      hasResultText: Boolean(result?.trim()),
      hasCrashLog: Boolean(crashLog?.trim()),
      continuedDiagnostic: Boolean(continuedDiagnosticBase),
      quickFix:
        displayAnalysis?.quickFixFirst ||
        analysis?.quickFixFirst ||
        "Not available",
    },
  });
}

async function runRefinedDiagnosticNow() {
    const nextLog = additionalRefineLog.trim() || crashLog.trim();

    if (!nextLog) {
      setErrorMsg(
        "Paste a crash log / error first, or add an additional crash log below.",
      );
      return;
    }

    await runDiagnostic(nextLog, { autoScroll: true });
  }

  function startResultRefinement(mode: "continue" | "still_crashing") {
    if (!displayAnalysis) return;

    const diagnosticText = buildDiagnosticResultText(displayAnalysis, result);

    const previousContinuationText = continuedDiagnosticBase?.text?.trim()
      ? `${continuedDiagnosticBase.text.trim()}\n\n--- Follow-up diagnostic ---\n\n`
      : "";

    const tempBase: FixHistoryItem = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      gameKey: selectedGameKey,
      gameTitle,
      type: "diagnostic_run",
      title: `${gameTitle} continued diagnostic base`,
      text: `${previousContinuationText}${diagnosticText}`,
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
    tone: "success" | "info" | "warning",
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

async function acceptAuthorizationGate() {
  if (!supportTelemetryEnabled) {
    setShowError(true);
    return;
  }

  try {
    const response = await fetchJSON<{
      ok: boolean;
      authorizationAccepted?: boolean;
      acceptedAt?: string;
      error?: string;
    }>(`${API_BASE_URL}/api/beta-authorization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-fmg-device-id": betaAccess.deviceId,
      },
      body: JSON.stringify({
        betaId: betaAccess.betaId,
        email: betaAccess.email,
        deviceId: betaAccess.deviceId,
      }),
    });

    if (!response.ok || !response.authorizationAccepted) {
      throw new Error(response.error || "Unable to save beta approval.");
    }

    const acceptedAccess = {
      ...betaAccess,
      authorizationAccepted: true,
    };

    setBetaAccess(acceptedAccess);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_AUTH_STORAGE_KEY, "true");
      window.localStorage.setItem(SUPPORT_TELEMETRY_STORAGE_KEY, "true");
    }

    setShowError(false);
    setHasAcceptedAuthorization(true);
  } catch {
    setShowError(true);
  }
}

  async function fetchBetaStatus() {
    try {
      const data = await fetchJSON<{ betaOpen: boolean; message?: string }>(
        `${API_BASE_URL}/api/beta-status?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      setBetaOpen(Boolean(data.betaOpen));
      setBetaMessage(
        data.message ||
          (data.betaOpen
            ? "FixMyGame beta is active."
            : "The FixMyGame beta period has ended."),
      );
    } catch (error) {
      setBetaOpen(false);
      setBetaMessage(
        error instanceof Error
          ? `FixMyGame could not verify beta access: ${error.message}`
          : "FixMyGame could not verify beta access right now.",
      );
    } finally {
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
      setErrorMsg(
        "Auto-fill system info is only available inside the Electron desktop app.",
      );
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

      showActionMessage(
        "System info detected and fields updated.",
        "diagnostic",
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Could not auto-fill system info.",
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
    analysisSummary?: FixHistoryItem["analysisSummary"],
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
    [fixHistoryItems],
  );

  const diagnosticHistoryItems = useMemo(
    () => fixHistoryItems.filter((item) => item.type === "diagnostic_run"),
    [fixHistoryItems],
  );

  const visibleHistoryItems =
    fixHistoryTab === "saved" ? savedHistoryItems : diagnosticHistoryItems;

  const selectedGameProfile = useMemo(
    () => effectiveGameProfile ?? GAME_PROFILES.minecraft,
    [effectiveGameProfile],
  );

  const topFeaturePills = useMemo(
    () => getTopFeaturePills(effectiveGameKey),
    [effectiveGameKey],
  );

  const fixPlan = useMemo(
    () =>
      getFixPlan(
        effectiveGameKey,
        effectiveGameTitle,
        displayAnalysis,
        displayDetectedSignals,
        selectedGameProfile,
        Boolean(
          missingModRecovery?.found && missingModRecovery.alreadyInCorrectPlace,
        ),
      ),
    [
      effectiveGameKey,
      effectiveGameTitle,
      displayAnalysis,
      displayDetectedSignals,
      selectedGameProfile,
      missingModRecovery?.found,
      missingModRecovery?.alreadyInCorrectPlace,
    ],
  );

  const activeSafeFixCategory =
    displayAnalysis?.detectedSignals?.likelyCategory ||
    displayDetectedSignals?.likelyCategory ||
    "";

  const isGameFilesCorrupt = activeSafeFixCategory === "game_files_corrupt";

  const isMissingDependency = activeSafeFixCategory === "missing_dependency";

  const isModConflict = activeSafeFixCategory === "mod_conflict";

  const isWrongFileLoaded =
    displayAnalysis?.detectedSignals?.likelyCategory === "wrong_file_loaded" ||
    displayDetectedSignals?.likelyCategory === "wrong_file_loaded";

  const unsafeAutoRepairMods = [
    "json assets",
    "jsonassets",
    "spacecore",
    "content patcher",
    "contentpatcher",
    "smapi",
    "stardew valley",
    "dlc.cpp",
    "graphics.cpp",
    "mod_manager.cpp",
    "game_application.cpp",
    "gamestate.cpp",
    "trigger_impl.cpp",
    "pdx_audio.cpp",
    "game.cpp",
    "descriptor.mod",
    "invalid",
    "failed",
    "error",
    "warning",
    "exception",
    "runtime",
    "std",
    "line",
    "file",
    "mod",
  ];

  function isBadModCandidate(value: string) {
    const mod = String(value || "")
      .trim()
      .toLowerCase();

    if (!mod) return true;
    if (unsafeAutoRepairMods.includes(mod)) return true;
    if (/^\d+$/.test(mod)) return true;
    if (mod.length < 3) return true;
    if (mod.endsWith(".cpp")) return true;
    if (mod.endsWith(".exe")) return true;
    if (mod.endsWith(".dll")) return true;
    if (mod.endsWith(".log")) return true;
    if (mod.endsWith(".txt")) return true;
    if (mod.includes(":")) return true;
    if (mod.includes("\\")) return true;
    if (mod.includes("/")) return true;

    return false;
  }

  function extractDuplicateModsFromLog(log: string) {
    const match = String(log || "").match(
      /duplicate mod detected:\s*["']?([^"'\n\r]+)["']?\s*(?:and)?\s*["']?([^"'\n\r]+)["']?/i,
    );

    if (!match) return [];

    return [match[1], match[2]]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  const safeFixSuspects = useMemo(() => {
    const category =
      displayAnalysis?.detectedSignals?.likelyCategory ||
      displayDetectedSignals?.likelyCategory ||
      "";

    if (
      category === "wrong_file_type_exe" ||
      category === "manifest_not_crash_log"
    ) {
      return [];
    }

    const duplicateMods = extractDuplicateModsFromLog(crashLog);

    const suspectsFromAnalysis =
      displayAnalysis?.detectedSignals?.suspectedMods ||
      displayDetectedSignals?.suspectedMods ||
      [];

    const source =
      duplicateMods.length > 0 ? duplicateMods : suspectsFromAnalysis;

    const normalized = source
      .map((item) =>
        String(item || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean)
      .filter((mod) => !isBadModCandidate(mod));

    return Array.from(new Set(normalized)).slice(0, 6);
  }, [displayAnalysis, displayDetectedSignals, crashLog]);
  const canApplySafeFix =
    appSettings.enableSafeFix &&
    desktopConnected &&
    safeFixSuspects.length > 0 &&
    activeSafeFixCategory === "mod_conflict";

  const hasDiagnosticResult = Boolean(
    hasRunDiagnosticThisSession && displayAnalysis && result,
  );
  const canUndoLastFix =
    hasDiagnosticResult && Boolean(lastFixResult?.movedFile);

  const primaryMissingModName = getPrimaryMissingModName();
  const missingModDownloadUrl = getMissingModDownloadUrl();
  const missingModAlreadyInstalled = Boolean(
    missingModRecovery?.found && missingModRecovery.alreadyInCorrectPlace,
  );

  const missingModWasFoundElsewhere = Boolean(
    missingModRecovery?.found &&
    !missingModRecovery.alreadyInCorrectPlace &&
    !missingModRecovery.justMovedToCorrectPlace,
  );

  const missingModRecoveryTarget = useMemo(() => {
    if (!displayAnalysis) return "";

    const lowerIssue = (displayAnalysis.issue || "").toLowerCase();
    const lowerCause = (displayAnalysis.mostLikelyCause || "").toLowerCase();
    const lowerQuickFix = (displayAnalysis.quickFixFirst || "").toLowerCase();
    const lowerSteps = (displayAnalysis.recommendedFixSteps || [])
      .join(" ")
      .toLowerCase();

    const category = displayAnalysis.detectedSignals?.likelyCategory || "";

    const stronglyMissingDependency =
      category === "missing_dependency" &&
      (lowerIssue.includes("missing mod") ||
        lowerIssue.includes("missing dependency") ||
        lowerCause.includes("missing mod") ||
        lowerCause.includes("missing dependency") ||
        lowerQuickFix.includes("install") ||
        lowerQuickFix.includes("missing") ||
        lowerSteps.includes("install the missing") ||
        lowerSteps.includes("requires mods which aren't installed") ||
        lowerSteps.includes("missing dependency"));

    if (!stronglyMissingDependency) return "";

    return primaryMissingModName || "";
  }, [displayAnalysis, primaryMissingModName]);

  const shouldShowMissingModRecovery =
    Boolean(missingModRecoveryTarget) &&
    displayAnalysis?.detectedSignals?.likelyCategory !== "game_files_corrupt";

  const effectiveDisplayAnalysis =
    missingModAlreadyInstalled && missingModRecoveryTarget && displayAnalysis
      ? {
          ...displayAnalysis,
          quickFixFirst: `${missingModRecoveryTarget} is already installed. Use a fresh log.`,
          issue: `FixMyGame found ${missingModRecoveryTarget} in the correct Mods folder. The loaded log may be old, or the mod was restored after the log was created.`,
          mostLikelyCause: `${missingModRecoveryTarget} is already in the correct Mods folder. The loaded log may be old, or the mod was restored after the log was created.`,
          probabilityBreakdown: [
            `100% - ${missingModRecoveryTarget} is already installed; fresh log needed`,
          ],
          recommendedFixSteps: [
            `Launch ${gameTitle} again so it creates a fresh log.`,
            "If the game still fails, load the newest log created after that launch.",
            "Run FixMyGame again with the fresh log.",
          ],
          needMoreInfo:
            "No more info is needed unless the game still fails after launching again with a fresh log.",
        }
      : displayAnalysis;

  const effectiveGuideQuickFix =
    missingModAlreadyInstalled && missingModRecoveryTarget
      ? `${missingModRecoveryTarget} is already installed. Use a fresh log.`
      : displayAnalysis?.quickFixFirst || "";

  const effectiveGuideSteps =
    missingModAlreadyInstalled && missingModRecoveryTarget
      ? [
          `Launch ${gameTitle} again so it creates a fresh log.`,
          "If the game still fails, load the newest log created after that launch.",
          "Run FixMyGame again with the fresh log.",
        ]
      : displayAnalysis?.recommendedFixSteps || [];

  const effectiveGuideCause =
    missingModAlreadyInstalled && missingModRecoveryTarget
      ? `${missingModRecoveryTarget} is already in the correct Mods folder. The loaded log may be old, or the mod was restored after the log was created.`
      : displayAnalysis?.mostLikelyCause || "";

  const effectiveSmartFixPath =
    missingModAlreadyInstalled && missingModRecoveryTarget
      ? {
          title: "Dependency already installed",
          bullets: [
            `${missingModRecoveryTarget} is already in the correct Mods folder.`,
            "Launch Stardew Valley again so SMAPI creates a fresh log.",
            "If the game still fails, load the newest log created after that launch.",
            "Run FixMyGame again with the fresh log.",
          ],
        }
      : smartFixPath;

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
      try {
  const savedBetaAccessRaw = window.localStorage.getItem(BETA_ACCESS_STORAGE_KEY);

  if (savedBetaAccessRaw) {
    const savedBetaAccess = JSON.parse(savedBetaAccessRaw) as BetaAccessState;

    setBetaAccess({
      ...DEFAULT_BETA_ACCESS,
      ...savedBetaAccess,
    });

    setBetaAccessEmailInput(savedBetaAccess.email || "");
    setBetaAccessIdInput(savedBetaAccess.betaId || "");
    setIsBetaAccess(isBetaAccessCurrentlyVerified(savedBetaAccess));
  }
} catch {
  setBetaAccess(DEFAULT_BETA_ACCESS);
  setIsBetaAccess(false);
}

setHasLoadedBetaAccess(true);
      resetLiveSessionState();

      setCopied(false);
      setSaved(false);

      const savedAuthorization =
        window.localStorage.getItem(APP_AUTH_STORAGE_KEY);
      setHasAcceptedAuthorization(savedAuthorization === "true");
      setCheckingAuthorization(false);

      const savedSupportTelemetry = window.localStorage.getItem(
        SUPPORT_TELEMETRY_STORAGE_KEY,
      );

if (savedAuthorization === "true") {
  window.localStorage.setItem(SUPPORT_TELEMETRY_STORAGE_KEY, "true");
  setSupportTelemetryEnabled(true);

  const hasSeenWhatsNew = window.localStorage.getItem(WHATS_NEW_STORAGE_KEY);

  if (!hasSeenWhatsNew) {
    setShowWhatsNewModal(true);
  }
} else {
  setSupportTelemetryEnabled(savedSupportTelemetry === "true");
}

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
          },
        );

        setDebugProStatus("debug skipped during beta");
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

  const detectSelectedGameInstall = React.useCallback(
    async (gameKey = selectedGameKey) => {
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
    },
    [selectedGameKey],
  );

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
- Or use "Scan Entire Folder" to search the game folder for useful logs`,
    );
  }

  function buildSafeFixPlanPreview(params: {
    suspectMods: string[];
    selectedGameKey: string;
  }) {
    const suspectMods = Array.isArray(params.suspectMods)
      ? params.suspectMods
      : [];
    const primarySuspect = suspectMods[0] || "the top matched suspect";
    const isDuplicateConflict = suspectMods.length >= 2;

    return [
      {
        id: "safe_fix_mods_used",
        title: isDuplicateConflict
          ? "Safe Repair: duplicate mods detected"
          : "Safe Repair: checked likely problem mods",
        detail: isDuplicateConflict
          ? `FixMyGame found duplicate/conflicting candidates: ${suspectMods.join(" ↔ ")}.`
          : suspectMods.length > 0
            ? `FixMyGame will check these suspected mods first: ${suspectMods.join(", ")}.`
            : "FixMyGame will check the most likely suspect from your diagnostic signals.",
      },
      {
        id: "safe_fix_move_candidate",
        title: isDuplicateConflict
          ? "Safe Repair: quarantine one duplicate"
          : "Safe Repair: temporarily disable likely problem mod",
        detail: isDuplicateConflict
          ? `FixMyGame will back up and quarantine ${primarySuspect} so only one duplicate remains active.`
          : `FixMyGame will back up and move ${primarySuspect} into quarantine if it is the best safe match in your Mods folder.`,
      },
      {
        id: "safe_fix_backup_created",
        title: "Safe Repair: backup created first",
        detail: "FixMyGame will create a backup before moving anything.",
      },
      {
        id: "safe_fix_new_location",
        title: "Safe Repair: quarantine location saved",
        detail:
          "FixMyGame will save the quarantined item location so you can undo the repair later.",
      },
    ];
  }

  function scrollToFixResultsArea() {
    if (!appSettings.autoScrollToResults) return;

    setTimeout(() => {
      const target = fixResultsRef.current;
      if (!target) return;

      const y = target.getBoundingClientRect().top + window.scrollY - 540;

      window.scrollTo({
        top: y,
        behavior: "smooth",
      });
    }, 150);
  }

  function scrollToContinueFromResult() {
    if (!appSettings.autoScrollToResults) return;

    setTimeout(() => {
      diagnosticBottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 250);

    setTimeout(() => {
      diagnosticBottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 600);
  }

  function addRepairTimelineItem(
    title: string,
    detail: string,
    status: RepairTimelineItem["status"] = "info",
  ) {
    setRepairTimeline((prev) =>
      [
        {
          id: crypto.randomUUID(),
          time: Date.now(),
          title,
          detail,
          status,
        },
        ...prev,
      ].slice(0, 12),
    );
  }

  async function applySafeFixNow() {
    setErrorMsg("");
    setFixPreviewError("");
    setFixExecutionResults([]);

    if (!window.fixMyGame?.applySafeFix) {
      setFixPreviewError(
        "Safe Fix is only available inside the Electron desktop app.",
      );
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
        "Safe Fix is only available for mod conflict results right now. This diagnosis needs manual steps instead.",
      );
      return;
    }

    try {
      setApplyingSafeFix(true);

      const response = await window.fixMyGame.applySafeFix({
        gameKey: effectiveGameKey,
        installPath: gameInstallPath || currentLogPath || "",
        suspectMods,
        actionLabel: "safe_fix_quarantine_mod",
      });

      if (!response?.ok) {
        const rawDetail = response?.error || "Safe Repair failed.";
        const usingPastedLog = !gameInstallPath && !currentLogPath;

        const detail = usingPastedLog
          ? "FixMyGame diagnosed the issue correctly, but Safe Repair needs access to a real local Mods folder. This is expected when you paste a crash log manually or when this game is not installed on this PC."
          : rawDetail.toLowerCase().includes("mods folder")
            ? "FixMyGame diagnosed the issue correctly, but Safe Repair could not find a local Mods folder for this game. This can happen if the game is not installed on this PC, the log was pasted manually, or the folder is stored somewhere custom."
            : rawDetail;

        setFixExecutionResults([
          {
            id: "safe_fix_unavailable",
            title: "Safe Repair unavailable",
            ok: false,
            detail,
          },
        ]);

        addRepairTimelineItem("Safe Repair unavailable", detail, "warning");

        setShowFixPreviewModal(false);

        scrollToFixResultsArea();

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
        "fixAssistant",
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
        gameKey: effectiveGameKey,
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
      scrollToFixResultsArea();
      pushSupportEvent("apply_safe_fix", `Applied safe fix for ${movedFile}`);
      recordEmergencyEvent({
        type: "safe_repair_completed",
        sessionId: supportSessionId,
        appVersion: FIXMYGAME_APP_VERSION,
        routeVersion: "v2-diagnostic-mapping",
        game: effectiveGameTitle,
        resultCategory:
          analysis?.detectedSignals?.likelyCategory ||
          detectedSignals?.likelyCategory,
        resultTitle: analysis?.issue,
        confidence: analysis?.confidenceLevel,
        metadata: {
          source: "apply_safe_fix_success",
          selectedGameKey,
          effectiveGameKey,
          movedFile,
          backupPath: response.backupPath,
          quarantinePath: response.quarantinePath,
          candidateKind: response.candidateKind,
          itemType: response.itemType,
        },
      });
      await sendSupportSnapshot(
        "apply_safe_fix",
        `Applied safe fix for ${movedFile}`,
      );
      addRepairTimelineItem(
        "Safe Repair applied",
        `${movedFile} was backed up and moved to quarantine.`,
        "success",
      );
      setLastUndoSucceeded(false);
      await detectSelectedGameInstall(effectiveGameKey);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Safe Fix failed.";

      recordEmergencyEvent({
        type: "safe_repair_failed",
        sessionId: supportSessionId,
        appVersion: FIXMYGAME_APP_VERSION,
        routeVersion: "v2-diagnostic-mapping",
        game: effectiveGameTitle,
        message,
        metadata: {
          source: "apply_safe_fix_failed",
          selectedGameKey,
          effectiveGameKey,
          activeSafeFixCategory,
        },
      });

      setFixPreviewError(message);
    } finally {
      setApplyingSafeFix(false);
    }
  }

  async function undoLastSafeFix() {
    recordEmergencyEvent({
      type: "undo_clicked",
      sessionId: supportSessionId,
      appVersion: FIXMYGAME_APP_VERSION,
      routeVersion: "v2-diagnostic-mapping",
      game: effectiveGameTitle,
      resultCategory:
        analysis?.detectedSignals?.likelyCategory ||
        detectedSignals?.likelyCategory,
      resultTitle: analysis?.issue,
      confidence: analysis?.confidenceLevel,
      metadata: {
        source: "undo_last_fix_button",
        selectedGameKey,
        effectiveGameKey,
      },
    });
    setErrorMsg("");
    setFixExecutionResults([]);

    if (!window.fixMyGame?.undoLastFix) {
      setErrorMsg(
        "Undo Last Fix is only available inside the Electron desktop app.",
      );
      return;
    }

    try {
      setUndoingSafeFix(true);

      const response = await window.fixMyGame.undoLastFix();

      if (!response?.ok) {
        const rawDetail = response?.error || "Undo Last Fix failed.";
        const isNoUndoCase = rawDetail
          .toLowerCase()
          .includes("no previous fix was found to undo");

        const detail = isNoUndoCase
          ? "There isn’t a recent Safe Fix to undo yet."
          : rawDetail;

        setFixExecutionResults([
          {
            id: "undo_fix_failed",
            title: isNoUndoCase
              ? "Nothing to undo yet"
              : "Undo Last Fix failed",
            ok: false,
            detail,
          },
        ]);
        addRepairTimelineItem(
          isNoUndoCase ? "Nothing to undo" : "Undo failed",
          detail,
          isNoUndoCase ? "warning" : "failed",
        );

        if (!isNoUndoCase) {
          setErrorMsg(detail);
        } else {
          showActionMessage(detail, "fixAssistant");
        }

        return;
      }

      const restoredFile = response.restoredFile || "mod";
      recordEmergencyEvent({
        type: "undo_clicked",
        sessionId: supportSessionId,
        appVersion: FIXMYGAME_APP_VERSION,
        routeVersion: "v2-diagnostic-mapping",
        game: effectiveGameTitle,
        resultCategory:
          analysis?.detectedSignals?.likelyCategory ||
          detectedSignals?.likelyCategory,
        resultTitle: analysis?.issue,
        confidence: analysis?.confidenceLevel,
        metadata: {
          source: "undo_last_fix_success",
          selectedGameKey,
          effectiveGameKey,
          restoredFile,
          originalPath: response.originalPath,
        },
      });

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

      addRepairTimelineItem(
        "Undo completed",
        `${restoredFile} was restored to its original folder.`,
        "success",
      );

      setLastUndoSucceeded(true);

      showActionMessage(
        `Undo complete: restored ${restoredFile}. You can launch the game again or run another diagnostic if needed.`,
        "fixAssistant",
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
        gameKey: effectiveGameKey,
        gameTitle,
        type: "fix_plan",
        title: `${gameTitle} undo last fix`,
        text: historyText,
      });

      setFixHistoryItems(nextHistory);
      pushSupportEvent("undo_last_fix", `Undid last fix for ${restoredFile}`);
      await sendSupportSnapshot(
        "undo_last_fix",
        `Undid last fix for ${restoredFile}`,
      );
      await detectSelectedGameInstall(effectiveGameKey);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Undo Last Fix failed.";

      recordEmergencyEvent({
        type: "app_error",
        sessionId: supportSessionId,
        appVersion: FIXMYGAME_APP_VERSION,
        routeVersion: "v2-diagnostic-mapping",
        game: effectiveGameTitle,
        message,
        metadata: {
          source: "undo_last_fix_failed",
          selectedGameKey,
          effectiveGameKey,
        },
      });

      setErrorMsg(message);
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
      const response = await window.fixMyGame?.openFolderPath?.(
        lastFixResult.quarantinePath,
      );

      if (!response?.ok) {
        setFixPreviewError(
          response?.error || "Could not open the quarantine folder.",
        );
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
      const response = await window.fixMyGame?.openFolderPath?.(
        lastFixResult.backupPath,
      );

      if (!response?.ok) {
        setFixPreviewError(
          response?.error || "Could not open the backup folder.",
        );
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
      setErrorMsg(
        "Desktop file loading is only available inside the Electron app.",
      );
      return;
    }

    try {
      setLoadingDesktopLog(true);

      const filePath = await window.fixMyGame.pickLogFile();
      if (!filePath) return;

      const contents = await window.fixMyGame.readLogFile(filePath);
      setHasAppliedAutoGameDetect(false);
      setCurrentLogPath(filePath);

      const activeGameKey = getActiveGameKeyForLoadedLog(contents);

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

    if (
      !window.fixMyGame?.pickScanFolder ||
      !window.fixMyGame?.scanCustomFolder
    ) {
      setErrorMsg("Folder scanning is only available inside the Electron app.");
      return;
    }

    try {
      const defaultScanPath = gameInstallPath || currentLogPath || "";

      const folderPath = await window.fixMyGame.pickScanFolder(defaultScanPath);
      if (!folderPath) return;

      const logs = await window.fixMyGame.scanCustomFolder(
        folderPath,
        selectedGameKey,
      );
      const normalizedLogs = Array.isArray(logs) ? logs : [];

      setDetectedLogs(normalizedLogs);
      setHasScannedLogs(true);

      if (normalizedLogs.length === 0) {
        setErrorMsg("No useful logs were found in the selected folder.");
        return;
      }

      const bestLog = normalizedLogs[0];

      if (!window.fixMyGame?.readLogFile) {
        setErrorMsg(
          "Desktop file loading is only available inside the Electron app.",
        );
        return;
      }

      const contents = await window.fixMyGame.readLogFile(bestLog.fullPath);
      setHasAppliedAutoGameDetect(false);
      setCurrentLogPath(bestLog.fullPath);

      const activeGameKey = getActiveGameKeyForLoadedLog(contents);

      setCrashLog(contents);
      setQuickSignals(quickDetect(contents, activeGameKey));
      setLogHighlights(extractLogHighlights(contents, activeGameKey));
      setLiveMods(extractModsFromLog(contents, activeGameKey));
      setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));

      showActionMessage(
        buildLoadedLogSummary({
          crashLog: contents,
        }) || `Loaded latest ${gameTitle} log.`,
        "fixAssistant",
      );
    } catch {
      setErrorMsg("Failed to scan the selected folder.");
    }
  }

  async function scanLogsForSelectedGame() {
    setErrorMsg("");
    setAutoDetectStatus("idle");

    if (!window.fixMyGame?.scanLogsForGame) {
      setErrorMsg(
        "Desktop connection not detected. Restart the Electron app and try again.",
      );
      return;
    }

    try {
      setScanningLogs(true);

      let installDetected = false;

      try {
        if (window.fixMyGame?.detectGameInstall) {
          const installResponse =
            await window.fixMyGame.detectGameInstall(selectedGameKey);
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
          setErrorMsg(
            "Desktop file loading is only available inside the Electron app.",
          );
          return;
        }

        const contents = await window.fixMyGame.readLogFile(bestLog.fullPath);
        setHasAppliedAutoGameDetect(false);
        setCurrentLogPath(bestLog.fullPath);

        const activeGameKey = getActiveGameKeyForLoadedLog(contents);

        setCrashLog(contents);
        setQuickSignals(quickDetect(contents, activeGameKey));
        setLogHighlights(extractLogHighlights(contents, activeGameKey));
        setLiveMods(extractModsFromLog(contents, activeGameKey));
        setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));

        showActionMessage(
          buildLoadedLogSummary({
            crashLog: contents,
          }) || `Loaded latest ${gameTitle} log.`,
          "fixAssistant",
        );
      }
    } catch {
      setErrorMsg(
        `Could not scan for ${gameTitle} logs. Restart the desktop app and try again.`,
      );
    } finally {
      setScanningLogs(false);
    }
  }

  async function loadDetectedLog(fullPath: string) {
    setErrorMsg("");
    setAutoDetectStatus("idle");

    if (!window.fixMyGame?.readLogFile) {
      setErrorMsg(
        "Desktop file loading is only available inside the Electron app.",
      );
      return;
    }

    try {
      setLoadingDesktopLog(true);

      const contents = await window.fixMyGame.readLogFile(fullPath);
      setHasAppliedAutoGameDetect(false);
      setCurrentLogPath(fullPath);

      const activeGameKey = getActiveGameKeyForLoadedLog(contents);

      setCrashLog(contents);
      setQuickSignals(quickDetect(contents, activeGameKey));
      setLogHighlights(extractLogHighlights(contents, activeGameKey));
      setLiveMods(extractModsFromLog(contents, activeGameKey));
      setMostSuspiciousLine(getMostSuspiciousLine(contents, activeGameKey));
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to load detected log.";
      setErrorMsg(msg);
    } finally {
      setLoadingDesktopLog(false);
    }
  }

  async function openModsFolder(
    silent = false,
    errorTarget: "top" | "quickActions" = "top",
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
          setTimedError(
            setFolderActionError,
            "Open Mods Folder is only available inside the Electron app.",
          );
        } else {
          setTimedError(
            setQuickActionFolderError,
            "Open Mods Folder is only available inside the Electron app.",
          );
        }
      }
      return false;
    }

    try {
      const response = await window.fixMyGame.openModsFolder(effectiveGameKey);

      if (!response?.ok) {
        const error = (response?.error || "").toLowerCase();

        if (!silent) {
          if (error.includes("not found") || error.includes("no such file")) {
            if (errorTarget === "top") {
              setFolderActionError(
                `No ${gameTitle} installation detected on this device.`,
              );
            } else {
              setQuickActionFolderError(
                `No ${gameTitle} installation detected on this device.`,
              );
            }
          } else if (error.includes("empty") || error.includes("no mods")) {
            if (errorTarget === "top") {
              setTimedError(
                setFolderActionError,
                `${gameTitle} is installed, but no mods folder was found or it is empty.`,
              );
            } else {
              setTimedError(
                setQuickActionFolderError,
                `${gameTitle} is installed, but no mods folder was found or it is empty.`,
              );
            }
          } else {
            if (errorTarget === "top") {
              setTimedError(
                setFolderActionError,
                response?.error ||
                  `Could not open the ${gameTitle} mods folder.`,
              );
            } else {
              setTimedError(
                setQuickActionFolderError,
                response?.error ||
                  `Could not open the ${gameTitle} mods folder.`,
              );
            }
          }
        }

        return false;
      }

      if (!silent) {
        showActionMessage(
          `Opened ${gameTitle} mods folder: ${response.path}`,
          "fixAssistant",
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
    errorTarget: "top" | "quickActions" = "top",
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
          setTimedError(
            setFolderActionError,
            "Open Logs Folder is only available inside the Electron app.",
          );
        } else {
          setTimedError(
            setQuickActionFolderError,
            "Open Logs Folder is only available inside the Electron app.",
          );
        }
      }
      return false;
    }

    try {
      const response = await window.fixMyGame.openLogsFolder(effectiveGameKey);

      if (!response?.ok) {
        const error = (response?.error || "").toLowerCase();

        if (!silent) {
          if (error.includes("not found") || error.includes("no such file")) {
            if (errorTarget === "top") {
              setTimedError(
                setFolderActionError,
                `No ${gameTitle} installation detected on this device.`,
              );
            } else {
              setTimedError(
                setQuickActionFolderError,
                `No ${gameTitle} installation detected on this device.`,
              );
            }
          } else if (error.includes("empty") || error.includes("no logs")) {
            if (errorTarget === "top") {
              setTimedError(
                setFolderActionError,
                `${gameTitle} is installed, but no crash logs were found yet. Launch the game once or generate a crash.`,
              );
            } else {
              setTimedError(
                setQuickActionFolderError,
                `${gameTitle} is installed, but no crash logs were found yet. Launch the game once or generate a crash.`,
              );
            }
          } else {
            if (errorTarget === "top") {
              setTimedError(
                setFolderActionError,
                response?.error ||
                  `Could not open the ${gameTitle} logs folder.`,
              );
            } else {
              setTimedError(
                setQuickActionFolderError,
                response?.error ||
                  `Could not open the ${gameTitle} logs folder.`,
              );
            }
          }
        }

        return false;
      }

      if (!silent) {
        showActionMessage(
          `Opened ${gameTitle} logs folder: ${response.path}`,
          "fixAssistant",
        );
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

  function simpleTextFingerprint(text: string) {
    const value = String(text || "");
    let hash = 0;

    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }

    return hash.toString(16);
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
      appVersion: FIXMYGAME_APP_VERSION,
      buildChannel: FIXMYGAME_BUILD_CHANNEL,
      eventType: params?.eventType || "manual_snapshot",
      eventDetail: params?.eventDetail || "",
      consent: {
        supportTelemetryEnabled,
        authorizationAccepted: hasAcceptedAuthorization,
      },
      game: {
        key: selectedGameKey,
        title: gameTitle,
        detectedGameKey,
        effectiveGameKey,
        effectiveGameTitle,
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
        crashLogLength: crashLog.length,
        crashLogFingerprint: simpleTextFingerprint(crashLog),
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

      const snapshotVid = getOrCreateDeviceId() || "unknown";

      const response = await fetchJSON<{
        ok: boolean;
        skipped?: boolean;
        id?: string;
        error?: string;
      }>(`${API_BASE_URL}/api/support-snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-fmg-device-id": snapshotVid,
        },
        body: JSON.stringify({
          ...snapshot,
          vid: snapshotVid,
        }),
      });

      console.log("Support snapshot sent:", response);
    } catch (error) {
      console.error("Support snapshot failed:", error);

      // Do not show telemetry failures to users.
      // Diagnostics should still feel successful even if support logging fails.
    }
  }

  async function runDiagnostic(
    overrideCrashLog?: string,
    options?: { autoScroll?: boolean },
  ) {
    setErrorMsg("");
    setResult("");

    setDetectedSignals(null);
    setAnalysis(null);
    setDiagnosticMarkedFixed(false);

    const logToUse = overrideCrashLog ?? crashLog;
    const autoScroll = options?.autoScroll ?? true;

    if (typeof logToUse !== "string" || !logToUse.trim()) {
      setErrorMsg("Paste a crash log / error first.");
      return;
    }

    const freshBeta = await fetchJSON<{
  betaOpen: boolean;
  message?: string;
  activeVersion?: string;
  minimumVersion?: string;
  buildChannel?: string;
}>(
  `${API_BASE_URL}/api/beta-status?t=${Date.now()}`,
  {
    method: "GET",
    cache: "no-store",
  },
);

    setBetaOpen(Boolean(freshBeta.betaOpen));
    setBetaMessage(freshBeta.message || "");

    if (!freshBeta.betaOpen) {
      setRunning(false);
      setErrorMsg(
        freshBeta.message ||
          "The FixMyGame beta period has ended. Access is currently closed.",
      );
      return;
    }
    const requiredVersion =
  freshBeta.minimumVersion || freshBeta.activeVersion || "";

if (requiredVersion && requiredVersion !== FIXMYGAME_APP_VERSION) {
  setRunning(false);
  setErrorMsg(
    `This beta version is no longer supported. Please download FixMyGame v${requiredVersion} from the official beta-download channel or approved Google Drive folder.`,
  );
  return;
}

    if (!canRun) {
  setErrorMsg(
    "Your FixMyGame beta access is not verified on this device.",
  );
  return;
}

    setRunning(true);

    recordEmergencyEvent({
      type: "diagnostic_started",
      sessionId: supportSessionId,
      appVersion: FIXMYGAME_APP_VERSION,
      routeVersion: "v2-diagnostic-mapping",
      game: effectiveGameTitle,
      metadata: {
        source: "run_diagnostic_started",
        selectedGameKey,
        effectiveGameKey,
        hasOverrideCrashLog: Boolean(overrideCrashLog),
        hasCrashLog: Boolean(logToUse.trim()),
        currentLogPath,
        autoScroll,
        continuedDiagnostic: Boolean(continuedDiagnosticBase),
        refinementMode: diagnosticRefineMode,
      },
    });

    try {
      const payload = {
        gameKey: effectiveGameKey,
        gameTitle: effectiveGameTitle,
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
                continuedDiagnosticBase.analysisSummary?.previousRelevantLog ||
                "",
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
      recordEmergencyEvent({
        type: "diagnostic_completed",
        sessionId: supportSessionId,
        appVersion: FIXMYGAME_APP_VERSION,
        routeVersion: "v2-diagnostic-mapping",
        game: effectiveGameTitle,
        resultCategory:
          nextAnalysis?.detectedSignals?.likelyCategory ||
          nextDetectedSignals?.likelyCategory,
        resultTitle: nextAnalysis?.issue,
        confidence: nextAnalysis?.confidenceLevel,
        metadata: {
          source: "diagnostic_completed",
          selectedGameKey,
          effectiveGameKey,
          currentLogPath,
          hasResultText: Boolean(nextResult.trim()),
          continuedDiagnostic: Boolean(continuedDiagnosticBase),
          refinementMode: diagnosticRefineMode,
          suspectedMods:
            nextAnalysis?.detectedSignals?.suspectedMods ||
            nextDetectedSignals?.suspectedMods ||
            [],
        },
      });

      setResult(nextResult);
      setHasRunDiagnosticThisSession(true);
      addRepairTimelineItem(
        "Diagnostic completed",
        `${effectiveGameTitle} analysis finished.`,
        "success",
      );
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
        nextResult,
      );

      if (diagnosticHistoryText.trim()) {
        addToFixHistory(
          "diagnostic_run",
          `${effectiveGameTitle} diagnostic run`,
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
          },
        );
        pushSupportEvent(
          "run_diagnostic",
          `Ran diagnostic for ${effectiveGameTitle}`,
        );
        await sendSupportSnapshot(
          "run_diagnostic",
          `Ran diagnostic for ${effectiveGameTitle}`,
        );
      }

      const lim = await fetchJSON<LimitResponse>(
        `${API_BASE_URL}/api/limit?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      setIsPro(Boolean(lim.isPro));
      setIsBetaAccess(Boolean(lim.isBeta));
      setLimit(Number.isFinite(lim.limit) ? lim.limit : 3);
      setRemaining(Number.isFinite(lim.remaining) ? lim.remaining : 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Diagnostic failed.";
      recordEmergencyEvent({
        type: "app_error",
        sessionId: supportSessionId,
        appVersion: FIXMYGAME_APP_VERSION,
        routeVersion: "v2-diagnostic-mapping",
        game: effectiveGameTitle,
        message: msg,
        metadata: {
          source: "run_diagnostic_failed",
          selectedGameKey,
          effectiveGameKey,
          currentLogPath,
          hasCrashLog: Boolean(logToUse.trim()),
          continuedDiagnostic: Boolean(continuedDiagnosticBase),
          refinementMode: diagnosticRefineMode,
        },
      });
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
        throw new Error(
          "Checkout failed. No Stripe checkout link was returned.",
        );
      }

      window.location.assign(data.url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Checkout failed.";
      setErrorMsg(msg);
    }
  }

  function buildDiagnosticResultText(
    analysisValue: AnalyzeResponse["analysis"] | null,
    resultValue: string,
  ) {
    return analysisValue
      ? [
          "Quick Fix First:",
          analysisValue.quickFixFirst,
          "",

          `Issue: ${analysisValue.issue}`,
          `Confidence Level: ${analysisValue.confidenceLevel}`,
          "",

          "Probability Breakdown:",
          ...analysisValue.probabilityBreakdown.map((item) => `- ${item}`),
          "",

          `Most Likely Cause: ${analysisValue.mostLikelyCause}`,
          "",

          ...(analysisValue.explanation?.whatThisMeans
            ? ["What This Means:", analysisValue.explanation.whatThisMeans, ""]
            : []),

          ...(analysisValue.explanation?.whyFixMyGameThinksThis?.length
            ? [
                "Why FixMyGame Thinks This:",
                ...analysisValue.explanation.whyFixMyGameThinksThis.map(
                  (item) => `- ${item}`,
                ),
                "",
              ]
            : []),

          ...(analysisValue.explanation?.beginnerExplanation
            ? [
                "Beginner Explanation:",
                analysisValue.explanation.beginnerExplanation,
                "",
              ]
            : []),

          "Recommended Fix Steps:",
          ...analysisValue.recommendedFixSteps.map(
            (step, index) => `${index + 1}. ${step}`,
          ),
          "",

          ...(analysisValue.explanation?.doNotDoYet?.length
            ? [
                "Do Not Do This Yet:",
                ...analysisValue.explanation.doNotDoYet.map(
                  (item) => `- ${item}`,
                ),
                "",
              ]
            : []),

          ...(analysisValue.explanation?.stillCrashingNextSteps?.length
            ? [
                "If It Still Crashes:",
                ...analysisValue.explanation.stillCrashingNextSteps.map(
                  (item) => `- ${item}`,
                ),
                "",
              ]
            : []),

          `Need More Info: ${analysisValue.needMoreInfo}`,
        ].join("\n")
      : resultValue;
  }

  async function saveResult() {
    if (!window.fixMyGame?.saveAnalysis) {
      setErrorMsg("Save is only available inside the Electron app.");
      return;
    }

    const textToSave = buildDiagnosticResultText(
      effectiveDisplayAnalysis,
      result,
    );

    if (!textToSave.trim()) return;

    const safeGame = (gameTitle || "game").replace(/[^\w\-]+/g, "_");
    const fileName = `fixmygame-${safeGame}-analysis.txt`;

    try {
      const response = await window.fixMyGame.saveAnalysis(
        fileName,
        textToSave,
      );

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
    const textToCopy = buildDiagnosticResultText(
      effectiveDisplayAnalysis,
      result,
    );

    if (!textToCopy.trim()) return;

    addToFixHistory(
      "full_result",
      `${effectiveGameTitle} diagnostic result`,
      textToCopy,
    );

    try {
      await copyTextReliable(textToCopy);
      setCopied(true);
      showActionMessage(
        "Copied to system clipboard and saved to Fix History.",
        "diagnostic",
      );
      setTimeout(() => {
        setCopied(false);
      }, 4000);
    } catch (error: unknown) {
      setCopied(false);
      showActionMessage(
        "Saved to Fix History. System clipboard copy failed on this device.",
        "diagnostic",
      );

      setErrorMsg(
        error instanceof Error ? error.message : "Failed to copy result.",
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
    if (!effectiveDisplayAnalysis) {
      setErrorMsg("Run a diagnostic first.");
      return;
    }

    const quickFixText = [
      `Quick Fix First: ${effectiveDisplayAnalysis.quickFixFirst}`,
      "",
      "Recommended Fix Steps:",
      ...effectiveDisplayAnalysis.recommendedFixSteps.map(
        (step, index) => `${index + 1}. ${step}`,
      ),
    ].join("\n");

    addToFixHistory(
      "quick_fix",
      `${effectiveGameTitle} quick fix`,
      quickFixText,
    );

    try {
      await copyTextReliable(quickFixText);
      setShowFixPreviewModal(false);
      showActionMessage(
        "Quick fix copied to clipboard and saved to Fix History.",
        "fixAssistant",
      );
    } catch (error: unknown) {
      setShowFixPreviewModal(false);
      showActionMessage(
        "Quick fix saved to Fix History. System clipboard copy failed on this device.",
        "fixAssistant",
      );

      setErrorMsg(
        error instanceof Error ? error.message : "Failed to copy quick fix.",
      );
    }
  }
  async function runFixPlan() {
    if (!fixPlan || !effectiveDisplayAnalysis) {
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
            `${index + 1}. ${action.title} — ${action.description} [${action.risk} risk]`,
        ),
      ].join("\n"),
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
          `Quick Fix First: ${effectiveDisplayAnalysis.quickFixFirst}`,
          "",
          "Recommended Fix Steps:",
          ...effectiveDisplayAnalysis.recommendedFixSteps.map(
            (step, index) => `${index + 1}. ${step}`,
          ),
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
              error instanceof Error
                ? error.message
                : "Failed to copy fix steps.",
          });
        }
      }
    }

    setFixExecutionResults(results);
    setRunningFixPlan(false);
    setShowFixPreviewModal(false);

    scrollToFixResultsArea();

    const successCount = results.filter((r) => r.ok).length;
    const totalCount = results.length;

    showActionMessage(
      `Fix plan finished: ${successCount}/${totalCount} safe actions completed.`,
      "fixAssistant",
    );
  }

  function openStepByStepGuide() {
    if (!effectiveDisplayAnalysis) {
      setErrorMsg("Run a diagnostic first.");
      return;
    }

    if (missingModAlreadyInstalled) {
      setCurrentGuideStep(0);
      setCompletedGuideSteps([]);
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
      "Are you sure? This will permanently delete all Fix History entries on this device.",
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
          showActionMessage(
            `Opened the folder for your loaded ${gameTitle} log.`,
            "fixAssistant",
          );
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

      setErrorMsg(
        `No ${gameTitle} installation or crash logs were detected on this device yet.`,
      );
      return;
    }

    if (selectedGameKey === "minecraft") {
      const openedLogs = await openLogsFolder(true);
      if (openedLogs) {
        showActionMessage(
          `Opened ${gameTitle} crash logs folder.`,
          "fixAssistant",
        );
        return;
      }

      const openedMods = await openModsFolder(true);
      if (openedMods) {
        showActionMessage(`Opened ${gameTitle} mods folder.`, "fixAssistant");
        return;
      }

      if (!crashLog.trim() && detectedLogs.length === 0) {
        setErrorMsg(
          `No ${gameTitle} installation or crash logs were detected on this device yet.`,
        );
      } else {
        showActionMessage(
          `${gameTitle} was detected from your loaded log, but no local game folder could be opened on this device.`,
          "fixAssistant",
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
        `No ${gameTitle} installation or crash logs were detected on this device yet.`,
      );
    } else {
      showActionMessage(
        `${gameTitle} was detected from your loaded log, but no local game folder could be opened on this device.`,
        "fixAssistant",
      );
    }
  }
  if (appLocked) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-2xl font-bold">FixMyGame is in closed beta</h1>
          <p className="mt-3 text-white/70">
            Access is currently limited to approved desktop beta testers.
          </p>
        </div>
      </main>
    );
  }

  if (
  checkingAuthorization ||
  loadingLimit ||
  checkingBetaStatus ||
  !hasLoadedBetaAccess
) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="text-sm text-white/50">
        Checking FixMyGame access...
      </div>
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

          <button
            type="button"
            onClick={fetchBetaStatus}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Refresh Access
          </button>
        </div>
      </main>
    );
  }

  if (shouldShowBetaAccessGate) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
          Private beta access
        </p>

        <h1 className="mt-3 text-3xl font-extrabold">
          Verify your FixMyGame access
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/65">
          Enter the email address and Beta ID approved for your FixMyGame
          testing account.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
              Approved email
            </span>

            <input
              type="email"
              value={betaAccessEmailInput}
              onChange={(event) =>
                setBetaAccessEmailInput(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
              Beta ID
            </span>

            <input
              type="text"
              value={betaAccessIdInput}
              onChange={(event) =>
                setBetaAccessIdInput(event.target.value.toUpperCase())
              }
              placeholder="FMG-0000"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
            />
          </label>
        </div>

        {betaAccessMessage && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            {betaAccessMessage}
          </div>
        )}

        <button
          type="button"
          onClick={verifyBetaAccess}
          disabled={verifyingBetaAccess}
          className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verifyingBetaAccess
            ? "Verifying access..."
            : "Verify beta access"}
        </button>
        <p className="mt-4 text-center text-sm text-white/55">
  Don&apos;t have approved access?{" "}
  <button
    type="button"
    onClick={openBetaFormPage}
    className="font-medium text-violet-300 underline decoration-violet-300/40 underline-offset-4 transition hover:text-violet-200"
  >
    Request beta access
  </button>
</p>
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
            Diagnose crash logs and mod conflicts for Minecraft, The Sims 4,
            Skyrim, Fallout 4, and other modded PC games. Detect dependency
            issues, plugin failures, loader mismatches, and GPU/driver faults.
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

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
          v{FIXMYGAME_APP_VERSION} · {FIXMYGAME_BUILD_CHANNEL}
        </span>
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
          {isPro
  ? "Pro Access"
  : betaAccessVerified
    ? "Verified Beta Access"
    : "Private Beta"}
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
          <div>
            <strong>Local vid:</strong> {debugVid || "none"}
          </div>
          <div>
            <strong>Server debug:</strong> {debugProStatus || "loading..."}
          </div>
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
            options={[
              "Auto Detect",
              "DirectX 11",
              "DirectX 12",
              "Vulkan",
              "OpenGL",
            ]}
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
            {loadingDesktopLog
              ? "Loading log..."
              : "Load Crash Log From Computer"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!hasUnlimitedAccess) {
                setProModalContext("autoDetect");
                setShowProModal(true);
                return;
              }

              scanLogsForSelectedGame();
            }}
            disabled={scanningLogs || !selectedGameProfile.supportsAutoDetect}
            className={[
              "rounded-xl px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
              hasUnlimitedAccess
                ? "bg-cyan-600 hover:bg-cyan-500"
                : "bg-amber-500/10 text-amber-200 border border-amber-400/20 hover:bg-amber-500/15",
            ].join(" ")}
          >
            {scanningLogs
              ? "Scanning..."
              : selectedGameProfile.supportsAutoDetect
                ? hasUnlimitedAccess
                  ? `Auto Detect ${gameTitle} Logs`
                  : `Auto Detect ${gameTitle} Logs (Pro)`
                : `Auto Detect ${gameTitle} Logs Not Available Yet`}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!hasUnlimitedAccess) {
                setProModalContext("folderScan");
                setShowProModal(true);
                return;
              }

              pickCustomScanFolder();
            }}
            className={[
              "rounded-xl px-4 py-2 font-medium transition",
              hasUnlimitedAccess
                ? "bg-white/10 hover:bg-white/15"
                : "bg-amber-500/10 text-amber-200 border border-amber-400/20 hover:bg-amber-500/15",
            ].join(" ")}
          >
            {hasUnlimitedAccess
              ? "Scan Entire Folder"
              : "Scan Entire Folder (Pro)"}
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
                  <div className="font-medium text-white truncate">
                    {log.name}
                  </div>
                  <div className="mt-1 text-xs text-white/50 break-all">
                    {log.fullPath}
                  </div>
                  <div className="mt-1 text-[11px] text-white/40">
                    {typeof log.size === "number"
                      ? `${Math.round(log.size / 1024)} KB`
                      : ""}
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
        (autoDetectStatus === "no_logs" ||
          autoDetectStatus === "not_installed") ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            No log loaded yet. Some games only create a fresh log after you
            launch the game at least once this session.
          </div>
        ) : null}

        {hasScannedLogs && detectedLogs.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            {autoDetectStatus === "not_installed" ? (
              <>
                {gameTitle} does not appear to be installed on this device yet.
                Install it first, or use &ldquo;Load Crash Log From
                Computer&rdquo; or &ldquo;Scan Entire Folder&rdquo; if your logs
                are stored somewhere custom.
              </>
            ) : (
              <>
                No {gameTitle} logs were found in the detected folders yet.{" "}
                {gameTitle} may be installed, but no logs have been created yet.
                Try &ldquo;Load Crash Log From Computer&rdquo; or &ldquo;Scan
                Entire Folder&rdquo;.
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
              const trimmed = value.trim();

              setCrashLog(value);
              setCurrentLogPath("");
              setAutoDetectStatus("idle");

              const detectedGame = appSettings.autoDetectGames
                ? detectGameFromLog(value)
                : null;

              const activeGameKey = detectedGame || selectedGameKey;

              if (!appSettings.autoDetectGames) {
                setDetectedGameKey(null);
                setAutoDetectNotice("");
              } else if (detectedGame) {
                setAutoDetectNotice("");
                setDetectedGameKey(detectedGame);
                setHasAppliedAutoGameDetect(true);

                if (detectedGame !== selectedGameKey) {
                  setSelectedGameKey(detectedGame);

                  showActionMessage(
                    `Detected game: ${GAME_PROFILES[detectedGame]?.label || detectedGame}`,
                    "fixAssistant",
                  );
                }
              } else {
                setDetectedGameKey(null);
                setHasAppliedAutoGameDetect(false);

                if (trimmed.length > 40) {
                  setAutoDetectNotice(
                    `FixMyGame will keep using your selected game: ${gameTitle}. If this is not the game you meant, choose the correct game before running the diagnostic.`,
                  );
                } else {
                  setAutoDetectNotice("");
                }
              }

              if (
                trimmed.length > 40 &&
                (!appSettings.autoDetectGames || detectedGame)
              ) {
                setQuickSignals(quickDetect(value, activeGameKey));
                setLogHighlights(extractLogHighlights(value, activeGameKey));
                setLiveMods(extractModsFromLog(value, activeGameKey));
                setMostSuspiciousLine(
                  getMostSuspiciousLine(value, activeGameKey),
                );
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
        {autoDetectNotice ? (
          <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.08)]">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-300">⚠️</span>
              <div>
                <div className="font-semibold text-amber-100">
                  Auto-detect could not identify this log
                </div>
                <div className="mt-1 text-amber-100/80">{autoDetectNotice}</div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {quickSignals.status ||
          quickSignals.session ||
          quickSignals.loader ||
          quickSignals.java ||
          quickSignals.issue ||
          quickSignals.error ? (
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
                    {getLoaderLabelForGame(effectiveGameKey)}:{" "}
                    {quickSignals.loader}
                  </span>
                ) : null}

                {quickSignals.java && getJavaLabelForGame(effectiveGameKey) ? (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    {getJavaLabelForGame(effectiveGameKey)} {quickSignals.java}
                  </span>
                ) : null}

                {quickSignals.issue ? (
                  <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-200">
                    Issue: {quickSignals.issue}
                  </span>
                ) : null}

                {quickSignals.error &&
                quickSignals.error !== quickSignals.issue ? (
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
                <span className="font-semibold">
                  {continuedDiagnosticBase.title}
                </span>
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
                    showActionMessage(
                      "Continuation mode cleared.",
                      "diagnostic",
                    );
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
              canRun && !running
                ? "bg-blue-600 hover:bg-blue-500"
                : "bg-blue-900/60 text-white/60",
            ].join(" ")}
            onClick={() => runDiagnostic()}
            disabled={!canRun || running}
          >
            {running ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Running Diagnostic...
              </>
            ) : !canRun ? (
  "Beta Access Required"
            ) : (
              `Run ${effectiveGameTitle} Diagnostic`
            )}
          </button>

          {actionMsg && actionMsgLocation === "diagnostic" ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-100">
              {actionMsg}
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between text-sm text-white/70">
            <div>
             {isPro
  ? "Pro access verified"
  : betaAccessVerified
    ? "Private beta access verified"
    : "Beta verification required"}
            </div>

            {!hasUnlimitedAccess && (
              <button
                type="button"
                className="underline underline-offset-4 hover:text-white"
                onClick={upgradeToPro}
              >
                Upgrade to Pro
              </button>
            )}
          </div>

          {!loadingLimit && !hasUnlimitedAccess && remaining <= 0 ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/40 p-4 text-sm text-amber-100">
              <div className="font-semibold">
                You’ve used all free diagnostics today.
              </div>
              <div className="mt-1 text-amber-100/90">
                Unlock unlimited diagnostics, automatic log discovery,
                full-folder scanning, saved analysis exports, and a faster
                troubleshooting workflow with Pro.
              </div>
            </div>
          ) : null}
          {errorMsg ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
              {errorMsg}
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

          <div ref={fixAssistantScrollRef} className="scroll-mt-6" />

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

                    recordEmergencyEvent({
                      type: "safe_repair_previewed",
                      sessionId: supportSessionId,
                      appVersion: FIXMYGAME_APP_VERSION,
                      routeVersion: "v2-diagnostic-mapping",
                      game: effectiveGameTitle,
                      resultCategory:
                        analysis?.detectedSignals?.likelyCategory ||
                        detectedSignals?.likelyCategory,
                      resultTitle: analysis?.issue,
                      confidence: analysis?.confidenceLevel,
                      metadata: {
                        source: "safe_repair_preview_button",
                        selectedGameKey,
                        effectiveGameKey,
                        activeSafeFixCategory,
                      },
                    });

                    setShowFixPreviewModal(true);
                  }}
                  disabled={!hasDiagnosticResult || !fixPlan}
                  className="w-full text-left text-white transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isModConflict
                    ? "🛠️ Safe Repair"
                    : isMissingDependency
                      ? "🧩 Repair Preview"
                      : "🧭 Guided Fix Preview"}
                </button>

                <p className="mt-2 ml-6 text-xs text-white/60">
                  FixMyGame backs up files first and only applies supported safe
                  fixes.
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
              FixMyGame can explain the fix, guide you through it, or safely
              handle supported fixes for you.
            </div>
          </div>
          <div ref={fixResultsRef} className="scroll-mt-6" />
          {repairTimeline.length > 0 ? (
            <details className="group mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-cyan-200/80">
                  <span className="text-white/80 transition-transform duration-200 group-open:rotate-180">
                    ▼
                  </span>
                  REPAIR SESSION TIMELINE
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRepairTimeline([]);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Clear
                </button>
              </summary>

              <div className="mt-4 grid gap-2">
                {repairTimeline.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{item.title}</div>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          item.status === "success"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : item.status === "failed"
                              ? "bg-red-500/20 text-red-300"
                              : item.status === "warning"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-cyan-500/20 text-cyan-300",
                        ].join(" ")}
                      >
                        {new Date(item.time).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-white/70">
                      {item.detail}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {fixExecutionResults.length > 0 ? (
            <div
              ref={fixResultsRef}
              className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
            >
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
                        {item.ok
                          ? "Done"
                          : item.id === "safe_fix_unavailable"
                            ? "Unavailable"
                            : "Failed"}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-white/70">
                      {item.detail}
                    </div>
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
                {lastUndoSucceeded ? (
                  <button
                    type="button"
                    onClick={() => {
                      recordEmergencyEvent({
                        type: "safe_repair_previewed",
                        sessionId: supportSessionId,
                        appVersion: FIXMYGAME_APP_VERSION,
                        routeVersion: "v2-diagnostic-mapping",
                        game: effectiveGameTitle,
                        resultCategory:
                          analysis?.detectedSignals?.likelyCategory ||
                          detectedSignals?.likelyCategory,
                        resultTitle: analysis?.issue,
                        confidence: analysis?.confidenceLevel,
                        metadata: {
                          source: "redo_safe_repair_button",
                          selectedGameKey,
                          effectiveGameKey,
                          lastUndoSucceeded,
                        },
                      });

                      setShowFixPreviewModal(true);
                    }}
                    disabled={applyingSafeFix || !canApplySafeFix}
                    className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {applyingSafeFix ? "Repairing..." : "Redo Safe Repair"}
                  </button>
                ) : null}
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
                {formatCategoryLabel(
                  displayDetectedSignals.likelyCategory,
                  selectedGameKey,
                )}
              </span>
            ) : null}

            {displayDetectedSignals.loader ? (
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-200">
                {getLoaderLabelForGame(selectedGameKey)}:{" "}
                {formatLoaderLabel(displayDetectedSignals.loader)}
              </span>
            ) : null}

            {displayDetectedSignals.gameVersion ? (
              <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
                {getVersionLabelForGame(selectedGameKey)}{" "}
                {displayDetectedSignals.gameVersion}
              </span>
            ) : null}

            {displayDetectedSignals.javaVersion &&
            getJavaLabelForGame(selectedGameKey) ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                {getJavaLabelForGame(selectedGameKey)}{" "}
                {displayDetectedSignals.javaVersion}
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
              {effectiveSmartFixPath.title}
            </div>

            <ul className="mt-4 grid gap-2">
              {effectiveSmartFixPath.bullets.map((bullet) => (
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
                    const shouldCopyDiagnosis =
                      isWrongFileLoaded ||
                      missingModAlreadyInstalled ||
                      safeFixSuspects.length === 0;

                    const textToCopy = shouldCopyDiagnosis
                      ? buildDiagnosticResultText(
                          effectiveDisplayAnalysis,
                          result,
                        )
                      : displayDetectedSignals?.suspectedMods?.length
                        ? displayDetectedSignals.suspectedMods.join(", ")
                        : liveMods.length
                          ? liveMods.join(", ")
                          : "No suspected mods detected.";

                    const historyType = shouldCopyDiagnosis
                      ? "full_result"
                      : "suspected_mods";
                    const historyTitle = shouldCopyDiagnosis
                      ? `${effectiveGameTitle} diagnostic result`
                      : `${effectiveGameTitle} suspected mods`;

                    addToFixHistory(historyType, historyTitle, textToCopy);

                    try {
                      await copyTextReliable(textToCopy);
                      setCopied(true);

                      showActionMessage(
                        shouldCopyDiagnosis
                          ? "Diagnosis copied and saved to Fix History."
                          : "Suspected mods copied and saved to Fix History.",
                        "smartFix",
                      );

                      setTimeout(() => {
                        setCopied(false);
                      }, 4000);
                    } catch (error: unknown) {
                      setCopied(false);

                      showActionMessage(
                        shouldCopyDiagnosis
                          ? "Diagnosis saved to Fix History. System clipboard copy failed on this device."
                          : "Suspected mods saved to Fix History. System clipboard copy failed on this device.",
                        "smartFix",
                      );

                      setErrorMsg(
                        error instanceof Error
                          ? error.message
                          : shouldCopyDiagnosis
                            ? "Failed to copy diagnosis."
                            : "Failed to copy suspected mods.",
                      );
                    }
                  }}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  {isWrongFileLoaded ||
                  missingModAlreadyInstalled ||
                  safeFixSuspects.length === 0
                    ? "Copy Diagnosis"
                    : "Copy Suspected Mods"}
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
        {hasRunDiagnosticThisSession && effectiveDisplayAnalysis ? (
          <div className="rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.55)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold tracking-widest text-white/70">
                DIAGNOSTIC RESULT
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!hasUnlimitedAccess) {
                      setProModalContext("saveAnalysis");
                      setShowProModal(true);
                      return;
                    }

                    saveResult();
                  }}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm transition",
                    isPro || betaOpen || isBetaAccess
                      ? "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                      : "border border-amber-400/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15",
                  ].join(" ")}
                >
                  {hasUnlimitedAccess
                    ? saved
                      ? "Saved!"
                      : "Save Results"
                    : "Save Export (Pro)"}
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
                  {effectiveDisplayAnalysis?.quickFixFirst}
                </div>
              </div>
              <div className="scroll-mt-4" />
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

                      recordEmergencyEvent({
                        type: "safe_repair_previewed",
                        sessionId: supportSessionId,
                        appVersion: FIXMYGAME_APP_VERSION,
                        routeVersion: "v2-diagnostic-mapping",
                        game: effectiveGameTitle,
                        resultCategory:
                          analysis?.detectedSignals?.likelyCategory ||
                          detectedSignals?.likelyCategory,
                        resultTitle: analysis?.issue,
                        confidence: analysis?.confidenceLevel,
                        metadata: {
                          source: "safe_repair_preview_button",
                          selectedGameKey,
                          effectiveGameKey,
                          activeSafeFixCategory,
                        },
                      });

                      setShowFixPreviewModal(true);
                    }}
                    disabled={!hasDiagnosticResult || !fixPlan}
                    className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isModConflict
                      ? "🛠️ Safe Repair"
                      : isMissingDependency
                        ? "🧩 Repair Preview"
                        : "🧭 Guided Fix Preview"}
                  </button>
                </div>
              </div>
              {shouldShowMissingModRecovery ? (
                <section className="mt-3 rounded-3xl border border-white/10 bg-[#071224] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    Repair Preview
                  </div>

                  <h3 className="mt-3 text-2xl font-bold text-white">
                    {missingModAlreadyInstalled
                      ? `${missingModRecoveryTarget} is already installed`
                      : `Recover or reinstall ${missingModRecoveryTarget}`}
                  </h3>

                  <p className="mt-2 text-sm text-white/70">
                    {missingModAlreadyInstalled
                      ? "FixMyGame found this mod in the correct Mods folder. This usually means the log is old or the mod was restored after the log was created."
                      : "FixMyGame can look for this mod on your device. If it finds the mod in the wrong place, it can move it back into your game’s Mods folder. If it is not found locally, you can open the download page directly."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={searchForMissingModOnDevice}
                      disabled={
                        searchingMissingMod || missingModAlreadyInstalled
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {missingModAlreadyInstalled
                        ? "Already Found"
                        : searchingMissingMod
                          ? "Searching This PC..."
                          : "Search This PC"}
                    </button>

                    <button
                      type="button"
                      onClick={moveFoundModIntoModsFolder}
                      disabled={
                        !missingModWasFoundElsewhere || movingMissingMod
                      }
                      className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {missingModAlreadyInstalled
                        ? "Already in Mods Folder"
                        : movingMissingMod
                          ? "Moving Mod..."
                          : "Move to Mods Folder"}
                    </button>

                    <button
                      type="button"
                      onClick={openMissingModDownloadPage}
                      disabled={
                        !missingModDownloadUrl || missingModAlreadyInstalled
                      }
                      className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {missingModAlreadyInstalled
                        ? "Download Not Needed"
                        : primaryMissingModName
                          ? `Open ${primaryMissingModName} Page`
                          : "Download Missing Mod"}
                    </button>

                    {missingModAlreadyInstalled ? (
                      <button
                        type="button"
                        onClick={() => runDiagnostic()}
                        disabled={!canRun || running}
                        className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {running ? "Running..." : "Run Fresh Diagnostic"}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                        Missing Mod
                      </div>
                      <div className="mt-2 text-white">
                        {primaryMissingModName}
                      </div>
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
                              <div className="break-all text-white">
                                {missingModRecovery.foundPath}
                              </div>
                            </div>

                            <div>
                              <div className="text-white/50">Needed in</div>
                              <div className="break-all text-white">
                                {missingModRecovery.expectedPath}
                              </div>
                            </div>

                            {missingModRecovery.justMovedToCorrectPlace ? (
                              <div className="text-emerald-300">
                                This mod was successfully moved back into the
                                correct Mods folder.
                              </div>
                            ) : missingModRecovery.alreadyInCorrectPlace ? (
                              <div className="text-emerald-300">
                                This mod is already in the correct Mods folder.
                                This log may be old, or the mod was restored
                                after the log was created. Launch the game again
                                and run a fresh diagnostic if the issue
                                continues.
                              </div>
                            ) : missingModRecovery.foundCandidateKind ===
                              "archive_file" ? (
                              <div className="text-amber-300">
                                A downloaded archive for this mod was found. It
                                still needs to be extracted or installed into
                                the Mods folder.
                              </div>
                            ) : (
                              <div className="text-cyan-200">
                                This mod was found outside the Mods folder and
                                can be moved back automatically.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-white/75">
                            This mod was not found in the common local locations
                            FixMyGame searched. Use the download button to
                            reinstall it.
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
                  <div className="mt-2 text-white">
                    {effectiveDisplayAnalysis.issue}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold tracking-widest text-white/60">
                    CONFIDENCE
                  </div>
                  <div
                    className={[
                      "mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
                      effectiveDisplayAnalysis.confidenceLevel === "High"
                        ? "bg-green-500/20 text-green-300"
                        : effectiveDisplayAnalysis.confidenceLevel === "Medium"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-red-500/20 text-red-300",
                    ].join(" ")}
                  >
                    {getConfidenceDisplayLabel(
                      effectiveDisplayAnalysis.confidenceLevel,
                      effectiveDisplayAnalysis.detectedSignals?.errorType,
                    )}
                  </div>{" "}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold tracking-widest text-white/60">
                  PROBABILITY BREAKDOWN
                </div>
                <ul className="mt-3 grid gap-2 text-white/90">
                  {effectiveDisplayAnalysis.probabilityBreakdown.map(
                    (item, index) => {
                      const formatted = formatProbabilityItem(item, index);

                      return (
                        <li
                          key={`${index}-${item}`}
                          className="rounded-xl bg-white/5 px-3 py-2"
                        >
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
                    },
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold tracking-widest text-white/60">
                  MOST LIKELY CAUSE
                </div>
                <div className="mt-2 text-white">
                  {effectiveDisplayAnalysis.mostLikelyCause}
                </div>
              </div>

              {effectiveDisplayAnalysis.explanation?.whatThisMeans ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold tracking-widest text-white/60">
                    WHAT THIS MEANS
                  </div>
                  <div className="mt-2 text-white/90">
                    {effectiveDisplayAnalysis.explanation.whatThisMeans}
                  </div>
                </div>
              ) : null}

              {effectiveDisplayAnalysis.explanation?.whyFixMyGameThinksThis
                ?.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold tracking-widest text-white/60">
                    WHY FIXMYGAME THINKS THIS
                  </div>
                  <ul className="mt-3 grid gap-2 text-white/90">
                    {effectiveDisplayAnalysis.explanation.whyFixMyGameThinksThis.map(
                      (item, index) => (
                        <li
                          key={`${index}-${item}`}
                          className="rounded-xl bg-white/5 px-3 py-2"
                        >
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}

              {effectiveDisplayAnalysis.explanation?.beginnerExplanation ? (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
                    BEGINNER EXPLANATION
                  </div>
                  <div className="mt-2 text-white/90">
                    {effectiveDisplayAnalysis.explanation.beginnerExplanation}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold tracking-widest text-white/60">
                  RECOMMENDED FIX STEPS
                </div>
                <ol className="mt-3 grid gap-2 text-white/90">
                  {effectiveDisplayAnalysis.recommendedFixSteps.map(
                    (step, index) => (
                      <li
                        key={`${index}-${step}`}
                        className="rounded-xl bg-white/5 px-3 py-2"
                      >
                        <span className="mr-2 font-semibold text-white">
                          {index + 1}.
                        </span>
                        {step}
                      </li>
                    ),
                  )}
                </ol>
              </div>

              {effectiveDisplayAnalysis.explanation?.doNotDoYet?.length ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                  <div className="text-xs font-semibold tracking-widest text-amber-200/80">
                    DO NOT DO THIS YET
                  </div>
                  <ul className="mt-3 grid gap-2 text-white/90">
                    {effectiveDisplayAnalysis.explanation.doNotDoYet.map(
                      (item, index) => (
                        <li
                          key={`${index}-${item}`}
                          className="rounded-xl bg-black/20 px-3 py-2"
                        >
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}

              {effectiveDisplayAnalysis.explanation?.stillCrashingNextSteps
                ?.length ? (
                <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
                  <div className="text-xs font-semibold tracking-widest text-violet-200/80">
                    IF IT STILL CRASHES
                  </div>
                  <ul className="mt-3 grid gap-2 text-white/90">
                    {effectiveDisplayAnalysis.explanation.stillCrashingNextSteps.map(
                      (item, index) => (
                        <li
                          key={`${index}-${item}`}
                          className="rounded-xl bg-black/20 px-3 py-2"
                        >
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold tracking-widest text-white/60">
                  NEED MORE INFO
                </div>
                <div className="mt-2 text-white/90">
                  {effectiveDisplayAnalysis.needMoreInfo}
                </div>
              </div>

              <details className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-xs font-semibold tracking-widest text-white/60">
                  RAW TEXT VERSION
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-sm leading-relaxed max-h-[300px] overflow-y-auto">
                  {result}
                </pre>
              </details>
              <div
                ref={continueResultRef}
                className="scroll-mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4"
              >
                <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
                  CONTINUE FROM THIS RESULT
                </div>

                {diagnosticMarkedFixed ? (
  <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
    <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
      MARKED FIXED
    </div>

    <div className="mt-2 text-white font-semibold">
      ✅ Current issue marked as fixed
    </div>

    <div className="mt-2 text-sm text-white/70">
      FixMyGame saved this result as fixed. You’re good to go unless the crash
      comes back.
    </div>

    <button
      type="button"
      onClick={() => setDiagnosticMarkedFixed(false)}
      className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      Undo
    </button>
  </div>
) : showDiagnosticRefineBox ? (
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
                      You can run the next diagnostic with your note only, or
                      add a newer crash log below if you want FixMyGame to
                      compare new evidence.
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
                            Paste a newer or more relevant crash/error log here
                            if you have one.
                          </div>

                          <textarea
                            value={additionalRefineLog}
                            onChange={(e) =>
                              setAdditionalRefineLog(e.target.value)
                            }
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
                  <div className="mt-3 flex w-full flex-col gap-3">
                    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-medium text-white">
        Was this result helpful?
      </p>
      <p className="mt-1 text-xs text-white/50">
        This rates the clarity of the diagnosis, not whether the crash is fixed.
      </p>
    </div>

    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => submitDiagnosticFeedback("helpful")}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          diagnosticFeedback === "helpful"
            ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100"
            : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white"
        }`}
      >
        👍 Helpful
      </button>

      <button
        type="button"
        onClick={() => submitDiagnosticFeedback("needs_work")}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          diagnosticFeedback === "needs_work"
            ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
            : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white"
        }`}
      >
        👎 Needs work
      </button>
    </div>
  </div>

  {diagnosticFeedback && (
    <p className="mt-3 text-xs text-white/50">
      {diagnosticFeedback === "helpful"
        ? "Thanks — this helps improve FixMyGame."
        : "Thanks — we’ll use this to improve future diagnostics."}
    </p>
  )}
</div>
                    <button
  type="button"
  onClick={async () => {
    setDiagnosticMarkedFixed(false);

    startResultRefinement("continue");

    pushSupportEvent(
      "continue_diagnostic_clicked",
      "User clicked Continue Diagnostic",
    );

    try {
      await sendSupportSnapshot(
        "continue_diagnostic_clicked",
        "User clicked Continue Diagnostic",
      );
    } catch (error) {
      console.error("Continue diagnostic snapshot failed:", error);
    }
  }}
  className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/15"
>
  Continue Diagnostic
</button>

                    <button
  type="button"
  onClick={async () => {
    setDiagnosticMarkedFixed(true);
    setShowDiagnosticRefineBox(false);
    setDiagnosticRefineMode(null);
    setDiagnosticRefineText("");
    setShowAdditionalRefineLogBox(false);
    setAdditionalRefineLog("");

    pushSupportEvent(
      "diagnostic_fixed_it_clicked",
      "User marked current issue as fixed",
    );

    recordEmergencyEvent({
      type: "fixed_it_clicked",
      sessionId: supportSessionId,
      appVersion: FIXMYGAME_APP_VERSION,
      routeVersion: "v2-diagnostic-mapping",
      game: effectiveGameTitle,
      resultCategory:
        analysis?.detectedSignals?.likelyCategory ||
        detectedSignals?.likelyCategory,
      resultTitle: analysis?.issue,
      confidence: analysis?.confidenceLevel,
      metadata: {
        source: "diagnostic_result_fixed_it_button",
        selectedGameKey,
        effectiveGameKey,
      },
    });

    try {
      await sendSupportSnapshot(
        "diagnostic_fixed_it_clicked",
        "User marked current issue as fixed",
      );
    } catch (error) {
      console.error("Diagnostic fixed snapshot failed:", error);
    }
  }}
  className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15"
>
  ✅ Fixed it
</button>

                    <button
                      type="button"
                      onClick={async () => {
                        pushSupportEvent(
                          "still_crashing_clicked",
                          "User clicked Still Crashing",
                        );

                        recordEmergencyEvent({
                          type: "still_crashing_clicked",
                          sessionId: supportSessionId,
                          appVersion: FIXMYGAME_APP_VERSION,
                          routeVersion: "v2-diagnostic-mapping",
                          game: effectiveGameTitle,
                          metadata: {
                            source: "still_crashing_button",
                          },
                        });

                        await sendSupportSnapshot(
                          "still_crashing_clicked",
                          "User clicked Still Crashing",
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
                If you test a fix and want FixMyGame to stay aware of this issue
                on your next diagnostic, continue from this result before
                loading a newer crash log.
              </p>
              <div ref={diagnosticBottomRef} className="h-1" />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[rgba(10,22,48,0.35)] p-5 text-white/70">
            Paste a {gameTitle} crash log or error report, then run a diagnostic
            to see results here.
          </div>
        )}
      </section>

        {showBetaShareModal ? (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    onClick={() => { setBetaShareReturnTarget(null); setShowBetaShareModal(false); }}
  >
    <div
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#071224] p-6 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
  <div>
    {betaShareReturnTarget === "settings" ? (
      <button
        type="button"
        onClick={() => {
          setShowBetaShareModal(false);
          setShowSettingsModal(true);
          setSettingsTab("Updates & Links");
          setBetaShareReturnTarget(null);
        }}
        className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        ← Back to Updates & Links
      </button>
    ) : null}

    <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
      SHARE FIXMYGAME BETA
    </div>

    <h2 className="mt-2 text-2xl font-bold text-white">
      Invite someone to test FixMyGame
    </h2>

    <p className="mt-2 text-sm text-white/60">
      Send a beta invite through email, copy the message for Discord or
      text, or open the app links directly.
    </p>
  </div>

  <button
    type="button"
    onClick={() => {
      setBetaShareReturnTarget(null);
      setShowBetaShareModal(false);
    }}
    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
  >
    ✕
  </button>
</div>

      <div className="mt-5 grid gap-3">
       <button
  type="button"
  onClick={openEmailBetaInvite}
  className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-left text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
>
  Email invite
  <div className="mt-1 text-xs font-normal text-cyan-100/60">
    Opens a prefilled plain-text email with the website and beta form links.
  </div>

  <div className="mt-2 rounded-lg border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-xs font-normal text-yellow-100/80">
    ⚠️ Email links may not appear clickable in every mail app. If needed,
    hover over the URL, or click directly after each URL and press Enter.
  </div>
</button>

        <button
          type="button"
          onClick={copyBetaInviteText}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Copy invite text
          <div className="mt-1 text-xs font-normal text-white/50">
            Best for Discord, text messages, DMs, or anywhere else.
          </div>
        </button>

        <button
          type="button"
          onClick={openBetaInvitePage}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Open website
          <div className="mt-1 text-xs font-normal text-white/50">
            Shows app info, visuals, guides, and general beta details.
          </div>
        </button>

        <button
          type="button"
          onClick={openBetaFormPage}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Open beta request form
          <div className="mt-1 text-xs font-normal text-white/50">
            Goes directly to the Google Form.
          </div>
        </button>
      </div>
    </div>
  </div>
) : null}

        {showWhatsNewModal ? (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    onClick={closeWhatsNewModal}
  >
    <div
      className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#071224] p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-semibold tracking-widest text-cyan-300/80">
        FIXMYGAME {FIXMYGAME_APP_VERSION} UPDATE
      </div>

      <h2 className="mt-3 text-2xl font-bold text-white">
        What’s new in this update
      </h2>

      <p className="mt-3 text-sm text-white/65">
        This update focuses on making FixMyGame safer, clearer, and easier to
        test during beta.
      </p>

      <div className="mt-5 space-y-3">
 <div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    New Updates & Links settings tab
  </div>
  <p className="mt-1 text-sm text-white/60">
    Added a dedicated Updates & Links tab in Settings so update notes, beta
    links, support options, and invite tools are easier to find.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Quick Links added to Settings
  </div>
  <p className="mt-1 text-sm text-white/60">
    Added quick access to the FixMyGame website, Discord beta server, beta
    invite sharing, issue reporting, beta request form, and feedback form.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Better beta invite flow
  </div>
  <p className="mt-1 text-sm text-white/60">
    The beta invite modal can now be opened from Settings, includes a return
    path back to Updates & Links, and supports copying or emailing the beta
    invite text.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Optional support moved
  </div>
  <p className="mt-1 text-sm text-white/60">
    Optional FixMyGame support was moved out of the App tab and into Updates &
    Links so app behavior settings stay separate from links and support.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    New FixMyGame Guides
  </div>
  <p className="mt-1 text-sm text-white/60">
    Added beginner-friendly guides for reading crash logs, missing
    dependencies, mod conflicts, fresh logs vs old logs, Safe Repair Preview,
    and verifying or reinstalling game files.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    New game-specific help pages
  </div>
  <p className="mt-1 text-sm text-white/60">
    Added targeted help pages for common Minecraft, Stardew Valley, and Lethal
    Company issues, including Java version errors, missing Fabric API, JEI
    dependency problems, empty SMAPI folders, and BepInEx log help.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Required beta diagnostic snapshots
  </div>
  <p className="mt-1 text-sm text-white/60">
    Beta builds now require anonymous diagnostic snapshots so bugs, failed
    repair paths, crash patterns, and confusing results can be reviewed during
    testing.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Fresh beta access checks
  </div>
  <p className="mt-1 text-sm text-white/60">
    FixMyGame now checks beta access again when running diagnostics, so the app
    responds correctly if beta access changes.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Better diagnostic feedback
  </div>
  <p className="mt-1 text-sm text-white/60">
    Diagnostic results can now be marked helpful or needs work, giving beta
    testing clearer feedback on what is working and what needs improvement.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Cleaner support and reporting
  </div>
  <p className="mt-1 text-sm text-white/60">
    Report issue emails now include helpful app details, version info, session
    details, diagnostic context, and a clearer note asking users to leave the
    technical details in place.
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-white">
    Behind-the-scenes support updates
  </div>
  <p className="mt-1 text-sm text-white/60">
    Added support for clearer emergency records, support snapshots, sitemap
    updates, guide discovery improvements, and safer beta testing workflows.
  </p>
</div>
</div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={closeWhatsNewModal}
          className="rounded-xl bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Got it
        </button>
      </div>
    </div>
  </div>
) : null}

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
                <div className="mt-2 text-sm text-white/70">
  Control privacy, diagnostics, and local app preferences.
  <div className="mt-2 text-sm text-white/50">
    Changes are saved automatically on this device.
  </div>
</div>
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
              <button
  type="button"
  onClick={() => setSettingsTab("Updates & Links")}
  className={[
    "rounded-xl px-4 py-2 text-sm font-medium transition",
    settingsTab === "Updates & Links"
      ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
      : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
  ].join(" ")}
>
  Updates & Links
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
                      Beta diagnostic snapshots are required while FixMyGame is
                      in beta.
                    </div>

                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Snapshots may include crash logs, detected issues,
                      selected game, mod/plugin names, repair results, and
                      basic system details. No unrelated personal files,
                      passwords, payment info, or full folder contents are
                      collected.
                    </p>

                    <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-cyan-200/80">
                      Current status: Required for beta / Enabled
                    </p>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
                        YOUR DATA
                      </div>

                      <div className="mt-3 text-sm text-white/70">
                        We never collect:
                      </div>

                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/60">
                        <li>Personal files or documents</li>
                        <li>Passwords or account information</li>
                        <li>Full folder contents</li>
                        <li>Payment or financial data</li>
                        <li>Anything unrelated to crash diagnostics</li>
                      </ul>
                    </div>

                    <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-100/80">
                      During beta, diagnostic snapshots stay enabled so FixMyGame can review bugs, failed repair paths, and crash patterns. Privacy controls can be expanded before the public release.
                    </div>
                  </div>
                </div>
              </div>
                        ) : settingsTab === "Updates & Links" ? (
  <div className="mt-5 grid gap-4">
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
      <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
        UPDATES & LINKS
      </div>

      <p className="mt-2 text-sm leading-6 text-white/60">
        View update notes, beta links, support options, and community info from
        one place.
      </p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-white">
            What’s New
          </div>
          <p className="mt-1 text-sm text-white/60">
            Reopen the update notes for FixMyGame {FIXMYGAME_APP_VERSION}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowSettingsModal(false);
            setShowWhatsNewModal(true);
          }}
          className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
        >
          View
        </button>
      </div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
  <div className="text-xs font-semibold tracking-widest text-white/50">
    QUICK LINKS
  </div>

  <div className="mt-4 grid gap-3 sm:grid-cols-2">
  <button
    type="button"
    onClick={openBetaInvitePage}
    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
  >
    <div className="text-sm font-semibold text-white">Website</div>
    <div className="mt-1 text-xs leading-5 text-white/50">
      Open the public FixMyGame site.
    </div>
  </button>

  <button
    type="button"
    onClick={openDiscordPage}
    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
  >
    <div className="text-sm font-semibold text-white">Discord</div>
    <div className="mt-1 text-xs leading-5 text-white/50">
      Open the FixMyGame beta server.
    </div>
  </button>

  <button
    type="button"
    onClick={() => {
      setBetaShareReturnTarget("settings");
      setShowSettingsModal(false);
      setShowBetaShareModal(true);
    }}
    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
  >
    <div className="text-sm font-semibold text-white">Share beta invite</div>
    <div className="mt-1 text-xs leading-5 text-white/50">
      Email or copy the invite text.
    </div>
  </button>

  <button
    type="button"
    onClick={openSupportEmail}
    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
  >
    <div className="text-sm font-semibold text-white">Report an issue</div>
    <div className="mt-1 text-xs leading-5 text-white/50">
      Send support email with app details.
    </div>
  </button>

  <button
    type="button"
    onClick={openBetaFormPage}
    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
  >
    <div className="text-sm font-semibold text-white">Beta request form</div>
    <div className="mt-1 text-xs leading-5 text-white/50">
      Open the beta request form.
    </div>
  </button>

  <button
    type="button"
    onClick={openFeedbackFormPage}
    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
  >
    <div className="text-sm font-semibold text-white">Feedback form</div>
    <div className="mt-1 text-xs leading-5 text-white/50">
      Share app feedback.
    </div>
  </button>
</div>
</div>
<div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
    OPTIONAL SUPPORT
  </div>

  <div className="mt-3 font-medium text-white">
    Support FixMyGame
  </div>

  <p className="mt-2 text-sm leading-6 text-white/60">
    FixMyGame beta is free to test. If the app helped you or
    you want to support continued development, optional
    donations help cover hosting, testing, bug review, and
    future app updates.
  </p>

  <button
    type="button"
    onClick={openDonationPage}
    className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
  >
    Open Donation Page
  </button>

  <p className="mt-3 text-xs text-white/45">
    Donations are optional and are not required for beta
    access.
  </p>
</div>
</div>
) : (
              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-white">
                        Auto-scroll to new results
                      </div>
                      <p className="mt-1 text-sm text-white/60">
                        Automatically move the page to new diagnostics, repair
                        results, and follow-up sections.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAppSettings((prev) => ({
                          ...prev,
                          autoScrollToResults: !prev.autoScrollToResults,
                        }))
                      }
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold transition",
                        appSettings.autoScrollToResults
                          ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : "border border-white/10 bg-white/5 text-white/60",
                      ].join(" ")}
                    >
                      {appSettings.autoScrollToResults ? "On" : "Off"}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-white">
                        Auto-detect game from logs
                      </div>
                      <p className="mt-1 text-sm text-white/60">
                        Automatically switch the selected game when FixMyGame
                        recognizes a loaded log. Turn this off if you want the
                        dropdown to stay on the game you picked.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAppSettings((prev) => ({
                          ...prev,
                          autoDetectGames: !prev.autoDetectGames,
                        }))
                      }
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold transition",
                        appSettings.autoDetectGames
                          ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : "border border-white/10 bg-white/5 text-white/60",
                      ].join(" ")}
                    >
                      {appSettings.autoDetectGames ? "On" : "Off"}
                    </button>
                  </div>
                </div>
                <SettingsPanel title="FIX ASSISTANT">
                  <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50/85">
                    FixMyGame automatically creates a backup before applying
                    safe fixes.
                  </div>

                  <SettingToggleRow
                    label="Enable Safe Repair"
                    description="Allow FixMyGame to suggest safe repair actions, like backing up and temporarily disabling likely problem mods."
                    checked={appSettings.enableSafeFix}
                    onChange={(checked) =>
                      setAppSettings((prev) => ({
                        ...prev,
                        enableSafeFix: checked,
                      }))
                    }
                  />

                  <SettingToggleRow
                    label="Confirm Before Applying Fix"
                    description="Always review changes before any fix is applied."
                    checked={appSettings.askBeforeFixing}
                    onChange={(checked) =>
                      setAppSettings((prev) => ({
                        ...prev,
                        askBeforeFixing: checked,
                      }))
                    }
                  />
                </SettingsPanel>

                <SettingsPanel title="DIAGNOSTIC DISPLAY">
                  <SettingToggleRow
                    label="Show Advanced Details"
                    description="Show detected signals, loader, version, and technical tags."
                    checked={appSettings.showAdvancedDetails}
                    onChange={(checked) =>
                      setAppSettings((prev) => ({
                        ...prev,
                        showAdvancedDetails: checked,
                      }))
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
                </SettingsPanel>

                <SettingsPanel title="HISTORY & LOCAL DATA">
                  <SettingToggleRow
                    label="Save Fix History"
                    description="Save diagnostics and copied fixes on this device."
                    checked={appSettings.saveFixHistory}
                    onChange={(checked) =>
                      setAppSettings((prev) => ({
                        ...prev,
                        saveFixHistory: checked,
                      }))
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
                    This resets saved game, GPU, driver version, and graphics
                    API preferences on this device.
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
                Complete one step at a time. Test the game after each major
                change.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                <div className="text-xs font-semibold tracking-widest text-yellow-200/80">
                  START HERE
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {effectiveGuideQuickFix}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {effectiveGuideSteps.map((step, index) => {
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
                <div className="mt-2 text-white">{effectiveGuideCause}</div>
              </div>
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="mb-3 text-sm text-white/60">
                Step{" "}
                {Math.min(currentGuideStep + 1, effectiveGuideSteps.length)} of{" "}
                {effectiveGuideSteps.length}
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
                    onClick={async () => {
                      const guideText = [
                        `Quick Fix First: ${effectiveGuideQuickFix}`,
                        "",
                        "Recommended Fix Steps:",
                        ...effectiveGuideSteps.map(
                          (step, index) => `${index + 1}. ${step}`,
                        ),
                        "",
                        `Most Likely Cause: ${effectiveGuideCause}`,
                      ].join("\n");

                      try {
                        await copyTextReliable(guideText);
                        showActionMessage(
                          "Guide steps copied to clipboard.",
                          "fixAssistant",
                        );
                      } catch {
                        setErrorMsg("Failed to copy guide steps.");
                      }
                    }}
                    className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    Copy Steps
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCompletedGuideSteps((prev) => {
                        if (prev.includes(currentGuideStep)) {
                          return prev.filter(
                            (stepIndex) => stepIndex !== currentGuideStep,
                          );
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
                        Math.min(prev + 1, effectiveGuideSteps.length - 1),
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

              <p className="mt-3 text-white/75">{fixPlan.description}</p>
            </div>

            <div className="custom-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {activeSafeFixCategory === "missing_dependency" ? (
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="text-xs font-semibold tracking-widest text-cyan-200/80">
                    NEXT STEP
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {missingModAlreadyInstalled
                      ? "Dependency already installed"
                      : "Download the missing mod."}
                  </div>

                  <div className="mt-2 text-sm text-white/70">
                    {missingModAlreadyInstalled
                      ? "The required mod is already in the correct Mods folder. Relaunch the game and run a fresh diagnostic if the issue continues."
                      : "FixMyGame will open the download page. Nothing will be moved or quarantined."}
                  </div>
                </div>
              ) : activeSafeFixCategory === "mod_conflict" ? (
                <>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
                      SAFE FIX
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {safeFixSuspects.length >= 2
                        ? "Back up and quarantine one duplicate mod."
                        : "Back up and quarantine the likely problem mod."}
                    </div>
                    <div className="mt-2 text-sm text-white/70">
                      {safeFixSuspects.length >= 2
                        ? `FixMyGame will back up and quarantine ${safeFixSuspects[0]} so only one duplicate remains active.`
                        : "FixMyGame will move the matched mod out of your active Mods folder so the game can test without it."}
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
                          <div className="font-medium text-white">
                            {item.title}
                          </div>
                          <div className="mt-1 text-sm text-white/65">
                            {item.detail}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                  <div className="text-xs font-semibold tracking-widest text-yellow-200/80">
                    {isWrongFileLoaded ? "WRONG FILE LOADED" : "MANUAL FIX"}
                  </div>

                  <div className="mt-2 text-lg font-semibold text-white">
                    {isWrongFileLoaded
                      ? "Load a real crash or error log."
                      : activeSafeFixCategory === "java_mismatch"
                        ? effectiveDisplayAnalysis?.quickFixFirst ||
                          "Install/select the correct Java version."
                        : "Follow the recommended steps."}
                  </div>

                  <div className="mt-2 text-sm text-white/70">
                    {isWrongFileLoaded
                      ? "No safe repair is available because this file does not contain a crash, mod failure, missing dependency, or repair target."
                      : "Automatic repair is not available for this result."}
                  </div>
                </div>
              )}

              {activeSafeFixCategory === "mod_conflict" &&
              safeFixSuspects.length === 0 ? (
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
                        : !desktopConnected
                          ? "Safe Repair Needs Desktop App"
                          : isWrongFileLoaded
                            ? "No Repair Target in This File"
                            : safeFixSuspects.length === 0
                              ? "No Safe Repair Target Found"
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
                  {runningFixPlan
                    ? "Opening Tools and Copying Steps..."
                    : "Guide Me Through It"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showFixFeedback ? (
  <div className="fixed bottom-6 right-6 z-50 w-[340px] rounded-2xl border border-white/10 bg-[#071224] p-5 shadow-2xl">
    {fixFeedbackConfirmed ? (
      <>
        <div className="text-xs font-semibold tracking-widest text-emerald-200/80">
          FIX CONFIRMED
        </div>

        <div className="mt-2 text-white font-semibold">
          ✅ Marked as fixed
        </div>

        <div className="mt-2 text-sm text-white/70">
          Nice — your game should be working now. You’re good to go unless the
          crash comes back.
        </div>

        <button
          type="button"
          onClick={() => {
            setShowFixFeedback(false);
            setFixFeedbackConfirmed(false);
          }}
          className="mt-4 w-full rounded-xl bg-emerald-500 px-3 py-2 font-medium text-black hover:bg-emerald-400"
        >
          Done
        </button>
      </>
    ) : (
      <>
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
              setFixFeedbackConfirmed(true);

              pushSupportEvent("fix_confirmed", "User said the fix worked");

              recordEmergencyEvent({
                type: "fixed_it_clicked",
                sessionId: supportSessionId,
                appVersion: FIXMYGAME_APP_VERSION,
                routeVersion: "v2-diagnostic-mapping",
                game: effectiveGameTitle,
                resultCategory:
                  analysis?.detectedSignals?.likelyCategory ||
                  detectedSignals?.likelyCategory,
                resultTitle: analysis?.issue,
                confidence: analysis?.confidenceLevel,
                metadata: {
                  source: "safe_repair_feedback_fixed_it_button",
                  selectedGameKey,
                  effectiveGameKey,
                },
              });

              setShowDiagnosticRefineBox(false);
              setDiagnosticRefineMode(null);
              setDiagnosticRefineText("");
              setShowAdditionalRefineLogBox(false);
              setAdditionalRefineLog("");

              try {
                await sendSupportSnapshot(
                  "fix_confirmed",
                  "User said the fix worked",
                );
              } catch (error) {
                console.error("Fix confirmed support snapshot failed:", error);
              }
            }}
            className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 font-medium text-black hover:bg-emerald-400"
          >
            ✅ Fixed it
          </button>

          <button
            onClick={async () => {
              setShowFixFeedback(false);
              setFixFeedbackConfirmed(false);

              pushSupportEvent(
                "still_crashing_after_fix",
                "User said the issue is still happening after safe repair",
              );

              recordEmergencyEvent({
                type: "still_crashing_after_fix",
                sessionId: supportSessionId,
                appVersion: FIXMYGAME_APP_VERSION,
                routeVersion: "v2-diagnostic-mapping",
                game: effectiveGameTitle,
                metadata: {
                  source: "safe_repair_feedback_modal",
                  selectedGameKey,
                  effectiveGameKey,
                },
              });

              try {
                await sendSupportSnapshot(
                  "still_crashing_after_fix",
                  "User said the issue is still happening after safe repair",
                );
              } catch (error) {
                console.error("Still crashing after fix snapshot failed:", error);
              }

              startResultRefinement("still_crashing");

              setShowAdditionalRefineLogBox(true);
            }}
            className="flex-1 rounded-xl bg-red-500/20 px-3 py-2 font-medium text-red-200 hover:bg-red-500/30"
          >
            ❌ Still crashing
          </button>
        </div>
      </>
    )}
  </div>
) : null}

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
                  This history stays on this device and saves fixes, results,
                  and copied text from FixMyGame so you can come back to them
                  later.
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
                        <div className="font-semibold text-white">
                          {item.title}
                        </div>
                        <div className="mt-1 text-xs text-white/50">
                          {item.gameTitle} •{" "}
                          {new Date(item.createdAt).toLocaleString()}
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
                                "diagnostic",
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
                              showActionMessage(
                                "History item copied to system clipboard.",
                                "fixAssistant",
                              );
                            } catch (error: unknown) {
                              showActionMessage(
                                "System clipboard copy failed on this device, but the item remains saved in Fix History.",
                                "fixAssistant",
                              );

                              setErrorMsg(
                                error instanceof Error
                                  ? error.message
                                  : "Failed to copy Fix History item.",
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

            <p className="mt-3 text-white/75">{proModalContent.description}</p>

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
                FixMyGame scans game-related files, reads logs, and can perform
                supported repair actions after you approve them.
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
                    Read log files to identify likely crashes, conflicts, and
                    missing dependencies
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
    BETA DIAGNOSTIC SNAPSHOTS
  </div>

  <div className="mt-3 text-sm text-white/90">
    FixMyGame beta requires anonymous diagnostic snapshots so bugs, failed
    repair paths, crash patterns, and confusing results can be reviewed during
    testing. Snapshots may include crash logs, detected issues, selected game,
    mod/plugin names, repair results, and basic system details.
  </div>

  <div className="mt-3 text-xs text-white/60">
    FixMyGame does not collect unrelated personal files, passwords, payment
    info, or full folder contents.
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
        I agree to share beta diagnostic snapshots for debugging and app
        improvement.
      </div>
      <div className="mt-1 text-xs text-white/60">
        Required for beta access. This helps FixMyGame review bugs, failed
        repair paths, crash patterns, and unclear diagnostic results during
        testing.
      </div>
    </div>
  </label>

  {showError ? (
    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">
      Beta access requires diagnostic snapshot permission before continuing.
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
                    Access unrelated personal files outside supported diagnostic
                    workflows
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

      <div className="mt-8 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => { setBetaShareReturnTarget(null); setShowBetaShareModal(true) }}
          className="text-white/50 transition hover:text-white"
        >
          Invite someone to beta
        </button>

        <button
  type="button"
  onClick={() => {
    recordEmergencyEvent({
      type: "feedback_submitted",
      sessionId: supportSessionId,
      appVersion: FIXMYGAME_APP_VERSION,
      routeVersion: "v2-diagnostic-mapping",
      game: effectiveGameTitle,
      resultCategory:
        analysis?.detectedSignals?.likelyCategory ||
        detectedSignals?.likelyCategory,
      resultTitle: analysis?.issue,
      confidence: analysis?.confidenceLevel,
      message: "User clicked Report an Issue from the bottom support link",
      metadata: {
        source: "bottom_report_issue_link",
        hasAnalysis: Boolean(analysis),
        hasCrashLog: Boolean(crashLog?.trim()),
        hasAdditionalCrashLog: false,
        continuedDiagnostic: Boolean(continuedDiagnosticBase),
        suspectedMods: "Not separately listed",
        quickFix: analysis?.quickFixFirst,
      },
    });

    openSupportEmail();
  }}
  className="text-white/50 transition hover:text-white"
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
    option.toLowerCase().includes(search.toLowerCase()),
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
                    option === "Custom / Other"
                      ? "border-t border-white/10 mt-1 pt-3"
                      : "",
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
