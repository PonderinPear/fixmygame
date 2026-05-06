const { contextBridge, ipcRenderer, clipboard } = require("electron");

contextBridge.exposeInMainWorld("fixMyGame", {
  ping: () => "Electron is working",
  scanLogsForGame: (gameKey) => ipcRenderer.invoke("scan-logs-for-game", gameKey),
  pickLogFile: () => ipcRenderer.invoke("pick-log-file"),
  pickScanFolder: (defaultPath) => ipcRenderer.invoke("pick-scan-folder", defaultPath),
  scanCustomFolder: (folderPath, gameKey) =>
  ipcRenderer.invoke("scan-custom-folder", folderPath, gameKey),
  readLogFile: (filePath) => ipcRenderer.invoke("read-log-file", filePath),
  saveAnalysis: (defaultPath, content) =>
    ipcRenderer.invoke("file:saveText", { defaultPath, content }),
  openModsFolder: (gameKey) => ipcRenderer.invoke("open-mods-folder", gameKey),
  openLogsFolder: (gameKey) => ipcRenderer.invoke("open-logs-folder", gameKey),
  openFolderPath: (targetPath) => ipcRenderer.invoke("open-folder-path", targetPath),
  detectGameInstall: (gameKey) => ipcRenderer.invoke("detect-game-install", gameKey),
  detectSystemSpecs: () => ipcRenderer.invoke("detect-system-specs"),
  findMissingModOnDevice: (payload) =>
  ipcRenderer.invoke("find-missing-mod-on-device", payload),

moveFoundModToModsFolder: (payload) =>
  ipcRenderer.invoke("move-found-mod-to-mods-folder", payload),

openExternalUrl: (url) =>
  ipcRenderer.invoke("open-external-url", url),
  closeApp: () => ipcRenderer.invoke("close-app"),
  previewSafeFix: (payload) => ipcRenderer.invoke("preview-safe-fix", payload),
  applySafeFix: (payload) => ipcRenderer.invoke("apply-safe-fix", payload),
  undoLastFix: () => ipcRenderer.invoke("undo-last-fix"),
  copyText: async (text) => {
    try {
      clipboard.writeText(String(text ?? ""));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to copy text.",
      };
    }
  },
});