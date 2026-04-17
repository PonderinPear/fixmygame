const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");
const { spawn, exec } = require("child_process");
const { scanLogsForGame, scanFolderRecursive } = require("./fileScanner");
const isDev = !app.isPackaged;
const os = require("os");

let mainWindow;
let nextServerProcess = null;

function writeStartupLog(...parts) {
  try {
    const logPath = path.join(app.getPath("userData"), "startup.log");
    const line =
      `[${new Date().toISOString()}] ` +
      parts.map((part) => {
        if (typeof part === "string") return part;
        try {
          return JSON.stringify(part);
        } catch {
          return String(part);
        }
      }).join(" ") +
      "\n";

    fs.appendFileSync(logPath, line, "utf8");
  } catch {}
}

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

function scoreMinecraftInstall(candidatePath) {
  let score = 0;
  const lower = candidatePath.toLowerCase();

  if (exists(path.join(candidatePath, "mods"))) score += 5;
  if (exists(path.join(candidatePath, "logs"))) score += 4;
  if (exists(path.join(candidatePath, "crash-reports"))) score += 4;
  if (exists(path.join(candidatePath, ".minecraft", "mods"))) score += 3;
  if (exists(path.join(candidatePath, ".minecraft", "logs"))) score += 3;
  if (exists(path.join(candidatePath, ".minecraft", "crash-reports"))) score += 3;

  if (lower.includes("curseforge")) score += 8;
  if (lower.includes("instances")) score += 6;
  if (lower.endsWith(".minecraft")) score += 2;

  return score;
}

function getMinecraftInstallCandidates() {
  const home = os.homedir();
  const appData = process.env.APPDATA || "";

  const roots = [];

  if (process.platform === "win32") {
    roots.push(
      path.join(appData, ".minecraft"),
      path.join(home, "curseforge", "minecraft", "Instances"),
      path.join(home, "AppData", "Roaming", "curseforge", "minecraft", "Instances"),
      path.join(home, "AppData", "Roaming", "CurseForge", "Minecraft", "Instances"),
      path.join(home, "AppData", "Local", "ModrinthApp", "profiles"),
      path.join(appData, "PrismLauncher", "instances"),
      path.join(appData, "MultiMC", "instances")
    );
  }

  const candidates = [];

  for (const root of roots) {
    if (!exists(root)) continue;

    candidates.push(root);

    for (const instance of collectInstanceFolders(root)) {
      candidates.push(instance);
    }
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getBestMinecraftInstallPath() {
  const candidates = getMinecraftInstallCandidates();

  if (!candidates.length) return null;

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreMinecraftInstall(candidate),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.candidate || null;
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

function getModsFolderForGame(gameKey) {
  const os = require("os");

  const home = os.homedir();
  const appData = process.env.APPDATA || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  const documents = path.join(home, "Documents");
  const steamCommonPaths = getSteamCommonPaths();

  const candidates = [];

  switch (gameKey) {
    case "minecraft": {
  const bestMinecraft = getBestMinecraftInstallPath();

  if (bestMinecraft) {
    candidates.push(
      path.join(bestMinecraft, "mods"),
      path.join(bestMinecraft, ".minecraft", "mods"),
      path.join(bestMinecraft, "minecraft", "mods")
    );
  }

  if (process.platform === "win32") {
    candidates.push(
      path.join(appData, ".minecraft", "mods")
    );
  }

  if (process.platform === "darwin") {
    candidates.push(
      path.join(home, "Library", "Application Support", "minecraft", "mods")
    );
  }

  if (process.platform === "linux") {
    candidates.push(
      path.join(home, ".minecraft", "mods")
    );
  }

  break;
}

    case "sims4":
      candidates.push(path.join(documents, "Electronic Arts", "The Sims 4", "Mods"));
      break;

    case "skyrimse":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Skyrim Special Edition", "Data")
        );
      }
      break;

    case "fallout4":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Fallout 4", "Data")
        );
      }
      break;

    case "gmod":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "GarrysMod", "garrysmod", "addons")
        );
      }
      break;

    case "stardew_valley":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Stardew Valley", "Mods")
        );
      }
      break;

    case "cyberpunk2077":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Cyberpunk 2077", "archive", "pc", "mod")
        );
      }
      break;

          case "fallout_new_vegas":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Fallout New Vegas", "Data")
        );
      }
      break;

    case "slime_rancher":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Slime Rancher", "Mods"),
          path.join(steamCommon, "Slime Rancher", "SRML", "Mods")
        );
      }
      break;

    case "baldurs_gate_3":
      candidates.push(
        path.join(localAppData, "Larian Studios", "Baldur's Gate 3", "Mods")
      );
      break;

    case "project_zomboid":
      candidates.push(
        path.join(home, "Zomboid", "mods")
      );
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "ProjectZomboid", "mods"),
          path.join(steamCommon, "ProjectZomboid", "Contents", "Java", "mods")
        );
      }
      break;

    case "witcher3":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "The Witcher 3", "Mods")
        );
      }
      break;

    case "seven_days_to_die":
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "7 Days To Die", "Mods")
        );
      }
      break;

    case "xcom2":
      candidates.push(
        path.join(documents, "My Games", "XCOM2", "XComGame", "Mods")
      );
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "XCOM 2", "XComGame", "Mods")
        );
      }
      break;

    default:
      return null;
  }

  return candidates.find(exists) || null;
}

function getLogsFolderForGame(gameKey) {
  const os = require("os");

  const home = os.homedir();
  const appData = process.env.APPDATA || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  const documents = path.join(home, "Documents");
  const steamCommonPaths = getSteamCommonPaths();

  const candidates = [];

  switch (gameKey) {
    case "minecraft": {
  const bestMinecraft = getBestMinecraftInstallPath();

  if (bestMinecraft) {
    candidates.push(
      path.join(bestMinecraft, "logs"),
      path.join(bestMinecraft, "crash-reports"),
      path.join(bestMinecraft, ".minecraft", "logs"),
      path.join(bestMinecraft, ".minecraft", "crash-reports"),
      path.join(bestMinecraft, "minecraft", "logs"),
      path.join(bestMinecraft, "minecraft", "crash-reports")
    );
  }

  if (process.platform === "win32") {
    candidates.push(
      path.join(appData, ".minecraft", "logs"),
      path.join(appData, ".minecraft", "crash-reports")
    );
  }

  if (process.platform === "darwin") {
    candidates.push(
      path.join(home, "Library", "Application Support", "minecraft", "logs"),
      path.join(home, "Library", "Application Support", "minecraft", "crash-reports")
    );
  }

  if (process.platform === "linux") {
    candidates.push(
      path.join(home, ".minecraft", "logs"),
      path.join(home, ".minecraft", "crash-reports")
    );
  }

  break;
}

    case "sims4":
      candidates.push(path.join(documents, "Electronic Arts", "The Sims 4"));
      break;

    case "skyrimse":
      candidates.push(path.join(documents, "My Games", "Skyrim Special Edition"));
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Skyrim Special Edition", "SKSE")
        );
      }
      break;

    case "fallout4":
      candidates.push(path.join(documents, "My Games", "Fallout4"));
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Fallout 4", "F4SE")
        );
      }
      break;

    case "gmod":
      candidates.push(path.join(localAppData, "Temp", "gmod"));
      break;

    case "stardew_valley":
      candidates.push(path.join(appData, "StardewValley", "ErrorLogs"));
      break;

    case "cyberpunk2077":
      candidates.push(path.join(localAppData, "CD Projekt Red", "Cyberpunk 2077"));
      break;
          case "fallout_new_vegas":
      candidates.push(path.join(documents, "My Games", "FalloutNV"));
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Fallout New Vegas")
        );
      }
      break;

    case "slime_rancher":
      candidates.push(path.join(localAppData, "Monomi Park", "Slime Rancher"));
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "Slime Rancher")
        );
      }
      break;

    case "baldurs_gate_3":
      candidates.push(path.join(localAppData, "Larian Studios", "Baldur's Gate 3"));
      break;

      case "project_zomboid":
        candidates.push(
        path.join(home, "Zomboid"),
        path.join(home, "Zomboid", "Logs"),
        path.join(home, "Zomboid", "console.txt")
      );
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "ProjectZomboid")
        );
      }
      break;

    case "witcher3":
      candidates.push(path.join(documents, "The Witcher 3"));
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "The Witcher 3")
        );
      }
      break;

    case "seven_days_to_die":
      candidates.push(path.join(appData, "7DaysToDie", "logs"));
      candidates.push(path.join(appData, "7DaysToDie"));
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "7 Days To Die")
        );
      }
      break;

    case "xcom2":
      candidates.push(path.join(documents, "My Games", "XCOM2"));
      for (const steamCommon of steamCommonPaths) {
        candidates.push(
          path.join(steamCommon, "XCOM 2")
        );
      }
      break;

    default:
      return null;
  }

  return candidates.find(exists) || null;
}

function loadEnvFile() {
  try {
    const envPath = isDev
      ? path.join(__dirname, "../web/.env.local")
      : path.join(process.resourcesPath, "web-standalone", "web", ".env.production");

    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      writeStartupLog("Loaded env file:", envPath);
    } else {
      writeStartupLog("Env file not found:", envPath);
    }
  } catch (error) {
    writeStartupLog("Failed to load env file:", error?.message || error);
  }
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    let serverProcess;

    if (isDev) {
      const webPath = path.join(__dirname, "../web");

      serverProcess = spawn(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["run", "start"],
        {
          cwd: webPath,
          stdio: "inherit",
          shell: true,
        }
      );
    } else {
      const serverPath = path.join(process.resourcesPath, "web-standalone", "web", "server.js");
      console.log("Using standalone server path:", serverPath);
console.log("Resources path:", process.resourcesPath);
console.log("Server exists:", fs.existsSync(serverPath));

writeStartupLog("Using standalone server path:", serverPath);
writeStartupLog("Resources path:", process.resourcesPath);
writeStartupLog("Server exists:", fs.existsSync(serverPath));

      serverProcess = spawn(
  process.execPath,
  [serverPath],
  {
    cwd: path.join(process.resourcesPath, "web-standalone", "web"),
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: "3001",
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
  }
);
    }

    nextServerProcess = serverProcess;

    serverProcess.on("error", (error) => {
  console.error("Next server process failed:", error);
  writeStartupLog("Next server process failed:", error?.message || error);
});

serverProcess.on("exit", (code, signal) => {
  console.log("Next server process exited with code:", code, "signal:", signal);
  writeStartupLog("Next server process exited with code:", code, "signal:", signal);
});


    const startTime = Date.now();
    const timeout = 30000;

    const checkServer = async () => {
      try {
        const res = await fetch("http://127.0.0.1:3001");
        if (res.ok) {
          resolve();
          return;
        }
      } catch {}

      if (Date.now() - startTime > timeout) {
        reject(new Error("Next server did not start in time."));
        return;
      }

      setTimeout(checkServer, 1000);
    };

    checkServer();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("did-start-loading", () => {
    console.log("did-start-loading");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("did-finish-load:", mainWindow.webContents.getURL());
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.log("did-fail-load:", errorCode, errorDescription, validatedURL);
    }
  );

  const appUrl = "http://127.0.0.1:3001";
console.log("Loading app URL:", appUrl, "isDev:", isDev);
writeStartupLog("Loading app URL:", appUrl, "isDev:", isDev);
mainWindow.loadURL(appUrl);
}

function detectSystemSpecsWindows() {
  return new Promise((resolve) => {
    const command =
      'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion | ConvertTo-Json -Compress"';

    exec(command, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({
          ok: false,
          error: "Could not detect system specs.",
        });
        return;
      }

      try {
        const raw = JSON.parse(String(stdout || "").trim());
        const firstGpu = Array.isArray(raw) ? raw[0] : raw;

        resolve({
          ok: true,
          gpuModel: firstGpu?.Name || "",
          driverVersion: firstGpu?.DriverVersion || "",
          graphicsApiMode: "Auto Detect",
        });
      } catch {
        resolve({
          ok: false,
          error: "System specs were detected but could not be parsed.",
        });
      }
    });
  });
}

function getCandidateInstallPaths(gameKey) {
  const home = os.homedir();
  const appData = process.env.APPDATA || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  const documents = path.join(home, "Documents");

  const candidates = {
    minecraft: getMinecraftInstallCandidates(),
    sims4: [
      path.join(home, "Documents", "Electronic Arts", "The Sims 4"),
    ],
    skyrimse: [
      path.join(home, "Documents", "My Games", "Skyrim Special Edition"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Skyrim Special Edition"),
    ],
    fallout4: [
      path.join(home, "Documents", "My Games", "Fallout4"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Fallout 4"),
    ],
    fallout_new_vegas: [
      path.join(home, "Documents", "My Games", "FalloutNV"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Fallout New Vegas"),
    ],
    gmod: [
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "GarrysMod"),
    ],
    stardew_valley: [
      path.join(home, "AppData", "Roaming", "StardewValley"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Stardew Valley"),
    ],
    slime_rancher: [
      path.join(localAppData, "Monomi Park", "Slime Rancher"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Slime Rancher"),
    ],
    slime_rancher_2: [
      path.join(localAppData, "Monomi Park", "SlimeRancher2"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Slime Rancher 2"),
    ],
    cyberpunk2077: [
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Cyberpunk 2077"),
      path.join("C:\\", "Program Files", "Cyberpunk 2077"),
    ],
    starfield: [
      path.join(home, "Documents", "My Games", "Starfield"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Starfield"),
    ],
    cities_skylines: [
      path.join(localAppData, "Colossal Order", "Cities_Skylines"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Cities_Skylines"),
    ],
    rimworld: [
      path.join(localAppData, "Low", "Ludeon Studios", "RimWorld by Ludeon Studios"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "RimWorld"),
    ],
    project_zomboid: [
      path.join(home, "Zomboid"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "ProjectZomboid"),
    ],
    terraria: [
      path.join(documents, "My Games", "Terraria"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Terraria"),
    ],
    kerbal_space_program: [
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Kerbal Space Program"),
    ],
    bannerlord: [
      path.join(documents, "Mount and Blade II Bannerlord"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Mount & Blade II Bannerlord"),
    ],
        baldurs_gate_3: [
      path.join(localAppData, "Larian Studios", "Baldur's Gate 3"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Baldurs Gate 3"),
    ],
    witcher3: [
      path.join(documents, "The Witcher 3"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "The Witcher 3"),
    ],
    seven_days_to_die: [
      path.join(appData, "7DaysToDie"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "7 Days To Die"),
    ],
    xcom2: [
      path.join(documents, "My Games", "XCOM2"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "XCOM 2"),
    ],
    valheim: [
      path.join(localAppData, "Low", "IronGate", "Valheim"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Valheim"),
    ],
    resident_evil_re: [
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "RESIDENT EVIL 4  BIOHAZARD RE4"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Resident Evil 2"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Resident Evil 3"),
    ],
    lethal_company: [
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Lethal Company"),
    ],
    palworld: [
      path.join(localAppData, "Pal", "Saved"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Palworld"),
    ],
  };

  return candidates[gameKey] || [];
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function safeFileName(name) {
  return String(name || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();
}

function timestampForFile() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function getFixMyGameDataRoot() {
  const root = path.join(app.getPath("documents"), "FixMyGame");
  ensureDir(root);
  return root;
}

function getBackupRoot() {
  const dir = path.join(getFixMyGameDataRoot(), "backups");
  ensureDir(dir);
  return dir;
}

function getQuarantineRoot() {
  const dir = path.join(getFixMyGameDataRoot(), "quarantine");
  ensureDir(dir);
  return dir;
}

function getManifestPath() {
  return path.join(getFixMyGameDataRoot(), "fix-manifest.json");
}

function readManifest() {
  const manifestPath = getManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeManifest(entries) {
  const manifestPath = getManifestPath();
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2), "utf8");
}

function appendManifestEntry(entry) {
  const entries = readManifest();
  entries.unshift(entry);
  writeManifest(entries);
  return entry;
}

function removeManifestEntry(id) {
  const entries = readManifest();
  const next = entries.filter((entry) => entry.id !== id);
  writeManifest(next);
}

function getLatestManifestEntry() {
  const entries = readManifest();
  return entries.length ? entries[0] : null;
}

function copyPathSafe(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));

  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function movePathSafe(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.renameSync(sourcePath, targetPath);
}

function resolveModsFolderFromInstallPath(gameKey, installPath) {
  if (!installPath) return null;

  const detectedByGame = getModsFolderForGame(gameKey);
  if (detectedByGame && fs.existsSync(detectedByGame)) {
    return detectedByGame;
  }

  const fallbackCandidates = [
    path.join(installPath, "mods"),
    path.join(installPath, "Mods"),
    path.join(installPath, "Data"),
    path.join(installPath, "archive", "pc", "mod"),
    path.join(installPath, "garrysmod", "addons"),
  ];

  return fallbackCandidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function normalizeNameForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-\s]+/g, "")
    .trim();
}

function normalizeSuspectNames(suspectNames = []) {
  return suspectNames
    .map((name) => normalizeNameForMatch(name))
    .filter(Boolean);
}

function scoreNameMatch(candidateName, loweredSuspects) {
  const normalizedCandidate = normalizeNameForMatch(candidateName);

  let bestScore = 0;
  let matchedSuspect = "";

  for (const suspect of loweredSuspects) {
    if (!suspect) continue;

    if (normalizedCandidate === suspect) {
      return { score: 100, matchedSuspect: suspect };
    }

    if (normalizedCandidate.includes(suspect)) {
      const score = suspect.length >= 8 ? 90 : 75;
      if (score > bestScore) {
        bestScore = score;
        matchedSuspect = suspect;
      }
    }

    if (suspect.includes(normalizedCandidate) && normalizedCandidate.length >= 4) {
      const score = 60;
      if (score > bestScore) {
        bestScore = score;
        matchedSuspect = suspect;
      }
    }
  }

  return { score: bestScore, matchedSuspect };
}

function isClearlyInvalidLooseModFile(fileName) {
  const lower = String(fileName || "").toLowerCase();

  return (
    lower.endsWith(".txt") ||
    lower.endsWith(".zip") ||
    lower.endsWith(".rar") ||
    lower.endsWith(".7z") ||
    lower.endsWith(".bak") ||
    lower.endsWith(".old") ||
    lower.endsWith(".disabled")
  );
}

function findSafeFixCandidate(modsFolder, suspectNames = []) {
  if (!modsFolder || !fs.existsSync(modsFolder)) return null;

  const loweredSuspects = normalizeSuspectNames(suspectNames);
  const primarySuspect = loweredSuspects[0] || "";
  const entries = fs.readdirSync(modsFolder, { withFileTypes: true });

  const allowedExtensions = [".jar", ".pak", ".package", ".ts4script", ".esp", ".esm", ".esl", ".dll"];
  const candidates = [];

  for (const entry of entries) {
    const entryName = entry.name;
    const entryPath = path.join(modsFolder, entryName);
    const { score, matchedSuspect } = scoreNameMatch(entryName, loweredSuspects);
    const normalizedEntryName = normalizeNameForMatch(entryName);

    if (!score) continue;

    if (entry.isDirectory()) {
  const innerEntries = safeReadDir(entryPath);
  const isEmptyFolder = innerEntries.length === 0;

  let finalScore = isEmptyFolder ? score + 30 : score + 10;

  if (primarySuspect && normalizedEntryName === primarySuspect) {
    finalScore += 50;
  }

  candidates.push({
    matchedPath: entryPath,
    matchedName: entryName,
    matchedSuspect: matchedSuspect || entryName,
    itemType: "folder",
    candidateKind: isEmptyFolder ? "empty_folder" : "mod_folder",
    score: finalScore,
  });

  continue;
}

   if (entry.isFile()) {
  const lowerName = entryName.toLowerCase();
  const isAllowedFile = allowedExtensions.some((ext) => lowerName.endsWith(ext));
  const isInvalidLooseFile = isClearlyInvalidLooseModFile(entryName);

  let finalScore = 0;

  if (isInvalidLooseFile) {
    finalScore = score + 25;
    if (primarySuspect && normalizedEntryName === primarySuspect) {
      finalScore += 50;
    }

    candidates.push({
      matchedPath: entryPath,
      matchedName: entryName,
      matchedSuspect: matchedSuspect || entryName,
      itemType: "file",
      candidateKind: "invalid_loose_file",
      score: finalScore,
    });
    continue;
  }

  if (isAllowedFile) {
    finalScore = score + 10;
    if (primarySuspect && normalizedEntryName === primarySuspect) {
      finalScore += 50;
    }

    candidates.push({
      matchedPath: entryPath,
      matchedName: entryName,
      matchedSuspect: matchedSuspect || entryName,
      itemType: "file",
      candidateKind: "mod_file",
      score: finalScore,
    });
  }
}
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

ipcMain.handle("close-app", async () => {
  try {
    app.quit();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to close app.",
    };
  }
});

ipcMain.handle("detect-system-specs", async () => {
  try {
    if (process.platform === "win32") {
      return await detectSystemSpecsWindows();
    }

    return {
      ok: false,
      error: "Auto-fill system specs is currently supported on Windows only.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to detect system specs.",
    };
  }
});

ipcMain.handle("detect-game-install", async (_event, gameKey) => {
  try {
    if (gameKey === "minecraft") {
      const bestMinecraft = getBestMinecraftInstallPath();

      if (bestMinecraft && exists(bestMinecraft)) {
        return {
          ok: true,
          detected: true,
          path: bestMinecraft,
        };
      }

      return {
        ok: true,
        detected: false,
        path: null,
      };
    }

    const candidates = getCandidateInstallPaths(gameKey);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return {
          ok: true,
          detected: true,
          path: candidate,
        };
      }
    }

    return {
      ok: true,
      detected: false,
      path: null,
    };
  } catch (error) {
    return {
      ok: false,
      detected: false,
      path: null,
      error: error instanceof Error ? error.message : "Install detection failed.",
    };
  }
});

ipcMain.handle("open-folder-path", async (_event, targetPath) => {
  try {
    if (!targetPath || typeof targetPath !== "string") {
      return { ok: false, error: "No target path provided." };
    }

    const folderPath = path.dirname(targetPath);

    if (!fs.existsSync(folderPath)) {
      return { ok: false, error: `Folder not found: ${folderPath}` };
    }

    const openResult = await shell.openPath(folderPath);

    if (openResult) {
      return { ok: false, error: openResult };
    }

    return { ok: true, path: folderPath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to open folder path.",
    };
  }
});

ipcMain.handle("pick-log-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select a game log file",
    properties: ["openFile"],
    filters: [
      { name: "Logs and Text Files", extensions: ["log", "txt", "json", "ini"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("pick-scan-folder", async (_event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a folder to scan",
    defaultPath: defaultPath && exists(defaultPath) ? defaultPath : undefined,
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("read-log-file", async (_event, filePath) => {
  return fs.readFileSync(filePath, "utf8");
});

ipcMain.handle("scan-logs-for-game", async (_event, gameKey) => {
  return scanLogsForGame(gameKey);
});

ipcMain.handle("scan-custom-folder", async (_event, folderPath, gameKey) => {
  return scanFolderRecursive(folderPath, gameKey);
});

ipcMain.handle("open-mods-folder", async (_event, gameKey) => {
  const modsFolder = getModsFolderForGame(gameKey);

  if (!modsFolder) {
    return { ok: false, error: `Could not determine the mods folder for game: ${gameKey || "unknown"}.` };
  }

  try {
    if (!fs.existsSync(modsFolder)) {
      return {
        ok: false,
        error: `Mods folder not found for ${gameKey || "this game"}.\nPath checked: ${modsFolder}`,
      };
    }

    const openResult = await shell.openPath(modsFolder);

    if (openResult) {
      return {
        ok: false,
        error: openResult,
      };
    }

    return { ok: true, path: modsFolder };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Failed to open mods folder.",
    };
  }
});

ipcMain.handle("open-logs-folder", async (_event, gameKey) => {
  const logsFolder = getLogsFolderForGame(gameKey);

  if (!logsFolder) {
    return { ok: false, error: `Could not determine the logs folder for game: ${gameKey || "unknown"}.` };
  }

  try {
    if (!fs.existsSync(logsFolder)) {
      return {
        ok: false,
        error: `Logs folder not found for ${gameKey || "this game"}.\nPath checked: ${logsFolder}`,
      };
    }

    const openResult = await shell.openPath(logsFolder);

    if (openResult) {
      return {
        ok: false,
        error: openResult,
      };
    }

    return { ok: true, path: logsFolder };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Failed to open logs folder.",
    };
  }
});

ipcMain.handle("file:saveText", async (_event, { defaultPath, content }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save analysis",
      defaultPath: defaultPath || "fixmygame-analysis.txt",
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(result.filePath, content, "utf8");
    return { canceled: false, ok: true, path: result.filePath };
  } catch (error) {
    return {
      canceled: false,
      ok: false,
      error: error.message || "Failed to save file",
    };
  }
});

ipcMain.handle("apply-safe-fix", async (_event, payload) => {
  try {
    const {
      gameKey,
      installPath,
      suspectMods = [],
      actionLabel = "quarantine_suspected_mod",
    } = payload || {};

    if (!installPath) {
      return {
        ok: false,
        error: "No install path was provided.",
      };
    }

    const modsFolder = resolveModsFolderFromInstallPath(gameKey, installPath);
    if (!modsFolder || !fs.existsSync(modsFolder)) {
      return {
        ok: false,
        error: "Mods folder was not found for this game instance.",
      };
    }

const candidate = findSafeFixCandidate(modsFolder, suspectMods);
if (!candidate) {
  return {
    ok: false,
    error: "No matching safe-fix candidate was found in the Mods folder.",
  };
}

const {
  matchedPath,
  matchedName,
  matchedSuspect,
  itemType,
  candidateKind,
} = candidate;

const originalFileName = path.basename(matchedPath);
const stamp = timestampForFile();
const safeGameKey = safeFileName(gameKey || "game");
const backupFolder = ensureDir(path.join(getBackupRoot(), safeGameKey, stamp));
const quarantineFolder = ensureDir(path.join(getQuarantineRoot(), safeGameKey, stamp));

const backupPath = path.join(backupFolder, originalFileName);
const quarantinePath = path.join(quarantineFolder, originalFileName);

copyPathSafe(matchedPath, backupPath);
movePathSafe(matchedPath, quarantinePath);

const manifestEntry = appendManifestEntry({
  id: `${safeGameKey}-${stamp}-${originalFileName}`,
  createdAt: new Date().toISOString(),
  gameKey: gameKey || "unknown",
  actionLabel,
  suspectMods,
  originalPath: matchedPath,
  backupPath,
  quarantinePath,
  fileName: originalFileName,
  matchedName,
  matchedSuspect,
  installPath,
  modsFolder,
  itemType,
  candidateKind,
  status: "applied",
});

    return {
  ok: true,
  entry: manifestEntry,
  movedFile: originalFileName,
  matchedName,
  matchedSuspect,
  itemType,
  candidateKind,
  originalPath: matchedPath,
  backupPath,
  quarantinePath,
};
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to apply safe fix.",
    };
  }
});

ipcMain.handle("undo-last-fix", async () => {
  try {
    const latest = getLatestManifestEntry();

    if (!latest) {
      return {
        ok: false,
        error: "No previous fix was found to undo.",
      };
    }

    if (!latest.quarantinePath || !fs.existsSync(latest.quarantinePath)) {
      return {
        ok: false,
        error: "The quarantined file could not be found.",
      };
    }

    ensureDir(path.dirname(latest.originalPath));
    movePathSafe(latest.quarantinePath, latest.originalPath);
    removeManifestEntry(latest.id);

    return {
      ok: true,
      restoredFile: latest.fileName,
      originalPath: latest.originalPath,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to undo last fix.",
    };
  }
});

app.whenReady().then(async () => {
  loadEnvFile();
  try {
      await startNextServer();

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
  console.error("Failed to start app:", error);
  writeStartupLog("Failed to start app:", error?.message || error);
  dialog.showErrorBox(
    "FixMyGame startup failed",
    `${error?.message || error}\n\nCheck startup.log in:\n${app.getPath("userData")}`
  );
  app.quit();
}
});

app.on("window-all-closed", () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }

  if (process.platform !== "darwin") app.quit();
});