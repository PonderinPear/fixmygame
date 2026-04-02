const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");
const { spawn } = require("child_process");
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
    case "minecraft":
  if (process.platform === "win32") {
    candidates.push(
      path.join(appData, ".minecraft", "mods"),
      path.join(home, "AppData", "Roaming", "CurseForge", "Minecraft", "Instances"),
      path.join(home, "AppData", "Roaming", "curseforge", "minecraft", "Instances"),
      path.join(home, "AppData", "Local", "ModrinthApp", "profiles"),
      path.join(appData, "PrismLauncher", "instances"),
      path.join(appData, "MultiMC", "instances")
    );

    const instanceRoots = [
      path.join(home, "AppData", "Roaming", "CurseForge", "Minecraft", "Instances"),
      path.join(home, "AppData", "Roaming", "curseforge", "minecraft", "Instances"),
      path.join(home, "AppData", "Local", "ModrinthApp", "profiles"),
      path.join(appData, "PrismLauncher", "instances"),
      path.join(appData, "MultiMC", "instances")
    ];

    for (const root of instanceRoots) {
      if (!exists(root)) continue;

      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          candidates.push(
            path.join(root, entry.name, "mods"),
            path.join(root, entry.name, ".minecraft", "mods"),
            path.join(root, entry.name, "minecraft", "mods")
          );
        }
      } catch {}
    }
  }

  if (process.platform === "darwin") {
    candidates.push(
      path.join(home, "Library", "Application Support", "minecraft", "mods"),
      path.join(home, "Library", "Application Support", "PrismLauncher", "instances"),
      path.join(home, "Library", "Application Support", "MultiMC", "instances")
    );
  }

  if (process.platform === "linux") {
    candidates.push(
      path.join(home, ".minecraft", "mods"),
      path.join(home, ".local", "share", "PrismLauncher", "instances"),
      path.join(home, ".local", "share", "MultiMC", "instances")
    );
  }
  break;

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
    case "minecraft":
  if (process.platform === "win32") {
    candidates.push(
      path.join(appData, ".minecraft", "logs"),
      path.join(appData, ".minecraft", "crash-reports"),
      path.join(home, "AppData", "Roaming", "CurseForge", "Minecraft", "Instances"),
      path.join(home, "AppData", "Roaming", "curseforge", "minecraft", "Instances"),
      path.join(home, "AppData", "Local", "ModrinthApp", "profiles"),
      path.join(appData, "PrismLauncher", "instances"),
      path.join(appData, "MultiMC", "instances")
    );

    const instanceRoots = [
      path.join(home, "AppData", "Roaming", "CurseForge", "Minecraft", "Instances"),
      path.join(home, "AppData", "Roaming", "curseforge", "minecraft", "Instances"),
      path.join(home, "AppData", "Local", "ModrinthApp", "profiles"),
      path.join(appData, "PrismLauncher", "instances"),
      path.join(appData, "MultiMC", "instances")
    ];

    for (const root of instanceRoots) {
      if (!exists(root)) continue;

      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          candidates.push(
            path.join(root, entry.name, "logs"),
            path.join(root, entry.name, "crash-reports"),
            path.join(root, entry.name, ".minecraft", "logs"),
            path.join(root, entry.name, ".minecraft", "crash-reports"),
            path.join(root, entry.name, "minecraft", "logs"),
            path.join(root, entry.name, "minecraft", "crash-reports")
          );
        }
      } catch {}
    }
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

    default:
      return null;
  }

  return candidates.find(exists) || null;
}

function loadEnvFile() {
  try {
    const envPath = isDev
      ? path.join(__dirname, "../web/.env.local")
      : path.join(process.resourcesPath, "web-standalone", "web", ".env.local");

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

function getCandidateInstallPaths(gameKey) {
  const home = os.homedir();

  const candidates = {
    minecraft: [
      path.join(home, "AppData", "Roaming", ".minecraft"),
      path.join(home, "curseforge", "minecraft", "Instances"),
      path.join(home, "AppData", "Roaming", "PrismLauncher", "instances"),
    ],
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
    gmod: [
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "GarrysMod"),
    ],
    stardew_valley: [
      path.join(home, "AppData", "Roaming", "StardewValley"),
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Stardew Valley"),
    ],
    cyberpunk2077: [
      path.join("C:\\", "Program Files (x86)", "Steam", "steamapps", "common", "Cyberpunk 2077"),
      path.join("C:\\", "Program Files", "Cyberpunk 2077"),
    ],
  };

  return candidates[gameKey] || [];
}

ipcMain.handle("detect-game-install", async (_event, gameKey) => {
  try {
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

ipcMain.handle("pick-scan-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a folder to scan",
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

ipcMain.handle("scan-custom-folder", async (_event, folderPath) => {
  return scanFolderRecursive(folderPath);
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