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

function scoreLogFile(fileName, fullPath, stats) {
  let score = 0;
  const lower = fileName.toLowerCase();

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

function collectLogsFromDirectory(dir) {
  const foundLogs = [];
  const entries = safeReadDir(dir);

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const lower = entry.name.toLowerCase();
    const isUseful =
  lower.endsWith(".log") ||
  lower.endsWith(".txt") ||
  lower.endsWith(".json") ||
  lower.startsWith("hs_err") ||
  lower.includes("crash") ||
  lower.includes("error") ||
  lower === "logoutput.log" ||
  lower === "latest.log";

    if (!isUseful) continue;

    const fullPath = path.join(dir, entry.name);

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      stats = undefined;
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
      const logs = collectLogsFromDirectory(dir);
      allLogs.push(...logs);
    }

    const directLogs = collectLogsFromDirectory(root);
    allLogs.push(...directLogs);
  }

  const deduped = Array.from(
    new Map(allLogs.map((log) => [log.fullPath, log])).values()
  );

  deduped.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (b.lastModified || 0) - (a.lastModified || 0);
  });

  return deduped.map(({ score, ...rest }) => rest);
}

function scanFolderRecursive(folderPath, depth = 0, maxDepth = 5) {
  if (!folderPath || !exists(folderPath) || depth > maxDepth) return [];

  const entries = safeReadDir(folderPath);
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...scanFolderRecursive(fullPath, depth + 1, maxDepth));
      continue;
    }

    if (!entry.isFile()) continue;

    const lower = entry.name.toLowerCase();
    const isUseful =
      lower.endsWith(".log") ||
      lower.endsWith(".txt") ||
      lower.endsWith(".json") ||
      lower.startsWith("hs_err") ||
      lower.includes("crash") ||
      lower.includes("error") ||
      lower === "logoutput.log" ||
      lower === "latest.log";

    if (!isUseful) continue;

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      stats = undefined;
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