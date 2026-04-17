const fs = require("fs");
const path = require("path");
const os = require("os");

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function getHomePaths() {
  const home = os.homedir();
  const appData = process.env.APPDATA || "";
  const localAppData = process.env.LOCALAPPDATA || "";

  return { home, appData, localAppData };
}

function getDocumentsPath() {
  return path.join(os.homedir(), "Documents");
}

function getCandidateDriveRoots() {
  if (process.platform !== "win32") return [];

  const roots = [];

  for (const letter of ["C", "D", "E", "F", "G"]) {
    roots.push(
      `${letter}:\\SteamLibrary`,
      `${letter}:\\Games`,
      `${letter}:\\Program Files`,
      `${letter}:\\Program Files (x86)`
    );
  }

  return roots;
}

function getSteamCommonPaths() {
  if (process.platform !== "win32") return [];

  const driveRoots = getCandidateDriveRoots();
  const results = [];

  for (const root of driveRoots) {
    results.push(
      path.join(root, "steamapps", "common"),
      path.join(root, "Steam", "steamapps", "common")
    );
  }

  return Array.from(new Set(results));
}

function getRootsForGame(gameKey) {
  const { home, appData, localAppData } = getHomePaths();
  const documents = getDocumentsPath();
  const steamCommonPaths = getSteamCommonPaths();
  const roots = [];

  switch (gameKey) {
    case "minecraft":
      if (process.platform === "win32") {
        roots.push(
          path.join(appData, ".minecraft"),
          path.join(appData, "PrismLauncher", "instances"),
          path.join(appData, "MultiMC", "instances"),
          path.join(localAppData, "Packages"),
          path.join(home, "curseforge", "minecraft", "Instances"),
          path.join(home, "AppData", "Roaming", "curseforge", "minecraft", "Instances"),
          path.join(home, "AppData", "Roaming", "CurseForge", "Minecraft", "Instances"),
          path.join(home, "AppData", "Local", "ModrinthApp", "profiles"),
          path.join(appData, "com.modrinth.theseus", "profiles")
        );
      }

      if (process.platform === "darwin") {
        roots.push(
          path.join(home, "Library", "Application Support", "minecraft"),
          path.join(home, "Library", "Application Support", "PrismLauncher", "instances"),
          path.join(home, "Library", "Application Support", "MultiMC", "instances"),
          path.join(home, "Library", "Application Support", "com.modrinth.theseus", "profiles"),
          path.join(home, "Library", "Application Support", "curseforge", "minecraft", "Instances")
        );
      }

      if (process.platform === "linux") {
        roots.push(
          path.join(home, ".minecraft"),
          path.join(home, ".local", "share", "PrismLauncher", "instances"),
          path.join(home, ".local", "share", "MultiMC", "instances"),
          path.join(home, ".config", "com.modrinth.theseus", "profiles"),
          path.join(home, ".local", "share", "curseforge", "minecraft", "Instances")
        );
      }
      break;

    case "sims4":
      roots.push(path.join(documents, "Electronic Arts", "The Sims 4"));
      break;

    case "skyrimse":
  roots.push(path.join(documents, "My Games", "Skyrim Special Edition"));

  for (const steamCommon of steamCommonPaths) {
    roots.push(
      path.join(steamCommon, "Skyrim Special Edition"),
      path.join(steamCommon, "Skyrim Special Edition", "Data"),
      path.join(steamCommon, "Skyrim Special Edition", "SKSE")
    );
  }
  break;

    case "fallout4":
  roots.push(path.join(documents, "My Games", "Fallout4"));

  for (const steamCommon of steamCommonPaths) {
    roots.push(
      path.join(steamCommon, "Fallout 4"),
      path.join(steamCommon, "Fallout 4", "Data"),
      path.join(steamCommon, "Fallout 4", "F4SE")
    );
  }
  break;

    case "gmod":
  roots.push(path.join(localAppData, "Temp", "gmod"));

  for (const steamCommon of steamCommonPaths) {
    roots.push(
      path.join(steamCommon, "GarrysMod"),
      path.join(steamCommon, "GarrysMod", "garrysmod"),
      path.join(steamCommon, "GarrysMod", "garrysmod", "addons")
    );
  }
  break;

    case "stardew_valley":
  roots.push(path.join(appData, "StardewValley", "ErrorLogs"));

  for (const steamCommon of steamCommonPaths) {
    roots.push(
      path.join(steamCommon, "Stardew Valley"),
      path.join(steamCommon, "Stardew Valley", "Mods")
    );
  }
  break;

    case "cyberpunk2077":
  roots.push(path.join(localAppData, "CD Projekt Red", "Cyberpunk 2077"));

  for (const steamCommon of steamCommonPaths) {
    roots.push(
      path.join(steamCommon, "Cyberpunk 2077"),
      path.join(steamCommon, "Cyberpunk 2077", "archive"),
      path.join(steamCommon, "Cyberpunk 2077", "archive", "pc"),
      path.join(steamCommon, "Cyberpunk 2077", "archive", "pc", "mod")
    );
  }
  break;
      case "fallout_new_vegas":
      roots.push(path.join(documents, "My Games", "FalloutNV"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Fallout New Vegas"),
          path.join(steamCommon, "Fallout New Vegas", "Data"),
          path.join(steamCommon, "Fallout New Vegas", "NVSE")
        );
      }
      break;

    case "slime_rancher":
      roots.push(path.join(localAppData, "Monomi Park", "Slime Rancher"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Slime Rancher"),
          path.join(steamCommon, "Slime Rancher", "Mods"),
          path.join(steamCommon, "Slime Rancher", "SRML", "Mods")
        );
      }
      break;

    case "slime_rancher_2":
      roots.push(path.join(localAppData, "Monomi Park", "SlimeRancher2"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Slime Rancher 2"),
          path.join(steamCommon, "Slime Rancher 2", "Mods"),
          path.join(steamCommon, "Slime Rancher 2", "BepInEx"),
          path.join(steamCommon, "Slime Rancher 2", "BepInEx", "plugins")
        );
      }
      break;

    case "baldurs_gate_3":
      roots.push(path.join(localAppData, "Larian Studios", "Baldur's Gate 3"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Baldurs Gate 3"),
          path.join(steamCommon, "Baldurs Gate 3", "Data"),
          path.join(steamCommon, "Baldurs Gate 3", "bin")
        );
      }
      break;

    case "witcher3":
      roots.push(path.join(documents, "The Witcher 3"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "The Witcher 3"),
          path.join(steamCommon, "The Witcher 3", "Mods")
        );
      }
      break;

    case "seven_days_to_die":
      roots.push(path.join(appData, "7DaysToDie"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "7 Days To Die"),
          path.join(steamCommon, "7 Days To Die", "Mods")
        );
      }
      break;

    case "xcom2":
      roots.push(path.join(documents, "My Games", "XCOM2"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "XCOM 2"),
          path.join(steamCommon, "XCOM 2", "XComGame"),
          path.join(steamCommon, "XCOM 2", "XComGame", "Mods")
        );
      }
      break;

    case "starfield":
      roots.push(path.join(documents, "My Games", "Starfield"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Starfield"),
          path.join(steamCommon, "Starfield", "Data")
        );
      }
      break;

    case "cities_skylines":
      roots.push(path.join(localAppData, "Colossal Order", "Cities_Skylines"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Cities_Skylines")
        );
      }
      break;

    case "rimworld":
      roots.push(path.join(localAppData, "Low", "Ludeon Studios", "RimWorld by Ludeon Studios"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "RimWorld"),
          path.join(steamCommon, "RimWorld", "Mods")
        );
      }
      break;

    case "project_zomboid":
      roots.push(path.join(home, "Zomboid"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "ProjectZomboid")
        );
      }
      break;

    case "terraria":
      roots.push(path.join(documents, "My Games", "Terraria"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Terraria"),
          path.join(steamCommon, "Terraria", "tModLoader"),
          path.join(steamCommon, "Terraria", "tModLoader", "Mods")
        );
      }
      break;

    case "kerbal_space_program":
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Kerbal Space Program"),
          path.join(steamCommon, "Kerbal Space Program", "GameData")
        );
      }
      break;

    case "bannerlord":
      roots.push(path.join(documents, "Mount and Blade II Bannerlord"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Mount & Blade II Bannerlord"),
          path.join(steamCommon, "Mount & Blade II Bannerlord", "Modules")
        );
      }
      break;

    case "valheim":
      roots.push(path.join(localAppData, "Low", "IronGate", "Valheim"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Valheim"),
          path.join(steamCommon, "Valheim", "BepInEx"),
          path.join(steamCommon, "Valheim", "BepInEx", "plugins")
        );
      }
      break;

    case "resident_evil_re":
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "RESIDENT EVIL 4  BIOHAZARD RE4"),
          path.join(steamCommon, "Resident Evil 2"),
          path.join(steamCommon, "Resident Evil 3"),
          path.join(steamCommon, "RESIDENT EVIL 4  BIOHAZARD RE4", "Mods"),
          path.join(steamCommon, "Resident Evil 2", "Mods"),
          path.join(steamCommon, "Resident Evil 3", "Mods")
        );
      }
      break;

    case "lethal_company":
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Lethal Company"),
          path.join(steamCommon, "Lethal Company", "BepInEx"),
          path.join(steamCommon, "Lethal Company", "BepInEx", "plugins")
        );
      }
      break;

    case "palworld":
      roots.push(path.join(localAppData, "Pal", "Saved"));
      for (const steamCommon of steamCommonPaths) {
        roots.push(
          path.join(steamCommon, "Palworld"),
          path.join(steamCommon, "Palworld", "Pal"),
          path.join(steamCommon, "Palworld", "Pal", "Saved")
        );
      }
      break;

    case "custom":
      roots.push(
        documents,
        appData,
        localAppData
      );
      for (const steamCommon of steamCommonPaths) {
        roots.push(steamCommon);
      }
      break;

    default:
      break;
  }

  return Array.from(new Set(roots.filter(Boolean)));
}

function collectInstanceFolders(baseDir) {
  if (!exists(baseDir)) return [];

  const entries = safeReadDir(baseDir);
  const instanceDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    instanceDirs.push(path.join(baseDir, entry.name));
  }

  return instanceDirs;
}

function getLogDirectoriesForRoot(rootDir) {
  const candidates = [
    path.join(rootDir, "logs"),
    path.join(rootDir, "Logs"),
    path.join(rootDir, "log"),
    path.join(rootDir, "Log"),
    path.join(rootDir, "crash-reports"),
    path.join(rootDir, "Crash Reports"),
    path.join(rootDir, ".minecraft", "logs"),
    path.join(rootDir, ".minecraft", "crash-reports"),
    path.join(rootDir, "minecraft", "logs"),
    path.join(rootDir, "minecraft", "crash-reports"),
    path.join(rootDir, "BepInEx", "LogOutput.log"),
    path.join(rootDir, "MelonLoader", "Latest.log"),
    path.join(rootDir, "profiles"),
    path.join(rootDir, "ErrorLogs"),
    path.join(rootDir, "SKSE"),
    path.join(rootDir, "F4SE")
  ];

  return candidates.filter(exists);
}

function isUsefulLogForGame(gameKey, fileName, fullPath) {
  const lowerName = fileName.toLowerCase();
  const lowerPath = fullPath.toLowerCase();

  if (gameKey === "minecraft") {
    if (lowerPath.includes("\\telemetry\\") || lowerPath.includes("/telemetry/")) {
      return false;
    }

    if (
      lowerName === "options.txt" ||
      lowerName === "usercache.json" ||
      lowerName === "realms_persistence.json" ||
      lowerName === "minecraftinstance.json" ||
      lowerName === "launcher_profiles.json" ||
      lowerName === "launcher_settings.json" ||
      lowerName === "version_manifest_v2.json" ||
      lowerName === "jre_manifest.json"
    ) {
      return false;
    }

    if (lowerPath.includes("essential") && lowerName.startsWith("connection-")) {
      return false;
    }

    return (
      lowerName === "latest.log" ||
      lowerName === "debug.log" ||
      lowerName === "logoutput.log" ||
      lowerName.startsWith("crash-") ||
      lowerName.startsWith("hs_err") ||
      lowerName.startsWith("launcher_log") ||
      (lowerPath.includes("crash-reports") && lowerName.endsWith(".txt")) ||
      (lowerPath.includes("logs") && lowerName.endsWith(".log"))
    );
  }

  if (gameKey === "stardew_valley") {
    if (
      lowerName === "smapi-latest.txt" ||
      lowerName === "smapi-crash.txt" ||
      lowerName === "latest.txt"
    ) {
      return true;
    }

    if (
      lowerPath.includes("stardewvalley\\errorlogs") ||
      lowerPath.includes("stardewvalley/errorlogs")
    ) {
      return lowerName.endsWith(".txt") || lowerName.endsWith(".log");
    }

    if (lowerName.endsWith(".json")) {
      return false;
    }

    if (
      lowerPath.includes("\\mods\\") ||
      lowerPath.includes("/mods/")
    ) {
      return false;
    }

    return lowerName.includes("smapi") && (lowerName.endsWith(".txt") || lowerName.endsWith(".log"));
  }

  return (
    lowerName.endsWith(".log") ||
    lowerName.endsWith(".txt") ||
    lowerName.startsWith("hs_err") ||
    lowerName.includes("crash") ||
    lowerName.includes("error") ||
    lowerName === "logoutput.log" ||
    lowerName === "latest.log"
  );
}

function scoreLogFile(fileName, fullPath, stats) {
  let score = 0;
  const lower = fileName.toLowerCase();

if (lower === "latest.log") score += 200;
if (lower === "debug.log") score += 140;
if (lower.startsWith("crash-") && lower.endsWith(".txt")) score += 220;
if (fullPath.toLowerCase().includes("crash-reports")) score += 120;
if (lower.startsWith("launcher_log")) score += 40;

if (fullPath.toLowerCase().includes("telemetry")) score -= 300;
if (fullPath.toLowerCase().includes("essential")) score -= 120;
if (lower.endsWith(".json")) score -= 200;
if (lower.startsWith("crash-") && lower.endsWith(".txt")) score += 120;
if (fullPath.toLowerCase().includes("crash-reports")) score += 50;
if (lower === "latest.log") score += 100;
if (lower.includes("crash")) score += 80;
if (lower.endsWith(".log")) score += 40;
if (lower.endsWith(".txt")) score += 20;
if (lower.startsWith("hs_err")) score += 60;
if (lower.includes("debug")) score += 10;
if (lower === "logoutput.log") score += 90;
if (lower === "latest.log") score += 100;
if (lower.includes("error")) score += 50;
if (lower.includes("bepinex")) score += 40;
if (lower.includes("melonloader")) score += 40;
if (lower.includes("skse")) score += 35;
if (lower.includes("f4se")) score += 35;

if (fullPath.toLowerCase().includes("crash-reports")) score += 30;
if (fullPath.toLowerCase().includes("logs")) score += 20;
if (fullPath.toLowerCase().includes("errorlogs")) score += 25;
if (fullPath.toLowerCase().includes("bepinex")) score += 25;
if (fullPath.toLowerCase().includes("melonloader")) score += 25;
if (fullPath.toLowerCase().includes("skse")) score += 20;
if (fullPath.toLowerCase().includes("f4se")) score += 20;

  if (stats && typeof stats.mtimeMs === "number") {
    score += Math.min(50, Math.floor((Date.now() - stats.mtimeMs) / -60000) + 50);
  }

  return score;
}

function collectLogsFromDirectory(dir, gameKey = null) {
  const foundLogs = [];
  const entries = safeReadDir(dir);

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const fullPath = path.join(dir, entry.name);

    if (!isUsefulLogForGame(gameKey, entry.name, fullPath)) continue;

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      stats = undefined;
    }

        if (stats && typeof stats.size === "number" && stats.size <= 0) {
      continue;
    }

    foundLogs.push({
      name: entry.name,
      fullPath,
      lastModified: stats?.mtimeMs,
      size: stats?.size,
      score: scoreLogFile(entry.name, fullPath, stats)
    });
  }

  return foundLogs;
}

function scanLogsForGame(gameKey) {
  const roots = getRootsForGame(gameKey);
  const allRootsToCheck = new Set();

  for (const root of roots) {
    if (!exists(root)) continue;

    allRootsToCheck.add(root);

    const instances = collectInstanceFolders(root);
    for (const instance of instances) {
      allRootsToCheck.add(instance);
    }
  }

  const allLogs = [];

  for (const root of allRootsToCheck) {
    const logDirs = getLogDirectoriesForRoot(root);

        for (const dir of logDirs) {
      const logs = collectLogsFromDirectory(dir, gameKey);
      allLogs.push(...logs);
    }

    const directLogs = collectLogsFromDirectory(root, gameKey);
    allLogs.push(...directLogs);
  }

    const deduped = Array.from(
    new Map(allLogs.map((log) => [log.fullPath.toLowerCase(), log])).values()
  );

  deduped.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (b.lastModified || 0) - (a.lastModified || 0);
  });

  return deduped.map(({ score, ...rest }) => rest);
}

function scanFolderRecursive(folderPath, gameKey = "minecraft", depth = 0, maxDepth = 5) {
  if (!folderPath || !exists(folderPath) || depth > maxDepth) return [];

  const entries = safeReadDir(folderPath);
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...scanFolderRecursive(fullPath, gameKey, depth + 1, maxDepth));
      continue;
    }

    if (!entry.isFile()) continue;

    const lower = entry.name.toLowerCase();
    if (!isUsefulLogForGame(gameKey, entry.name, fullPath)) continue;

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      stats = undefined;
    }

        if (stats && typeof stats.size === "number" && stats.size <= 0) {
      continue;
    }

    results.push({
      name: entry.name,
      fullPath,
      lastModified: stats?.mtimeMs,
      size: stats?.size,
      score: scoreLogFile(entry.name, fullPath, stats)
    });
  }

  results.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (b.lastModified || 0) - (a.lastModified || 0);
  });

  return results.map(({ score, ...rest }) => rest);
}

module.exports = {
  scanLogsForGame,
  scanFolderRecursive
};